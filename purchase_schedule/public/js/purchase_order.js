// Copyright (c) 2026, yash joshi and contributors
// For license information, please see license.txt

// Purchase Order schedule — mirrors ERPNext's Sales Order "Delivery Schedule" dialog.

frappe.provide("purchase_schedule.po_schedule");

// Compact "Add Schedule" button in the Purchase Order items grid.
frappe.dom.set_style(
	`[data-fieldname="items"] [data-fieldname="add_schedule"] .btn {
		font-size: 11px;
		line-height: 1.2;
		padding: 2px 6px;
		height: auto;
		min-height: 0;
	}`,
	"purchase-schedule-add-schedule-btn"
);

purchase_schedule.po_schedule = {
	doctype: "Purchase Receipt Schedule",
	api: "purchase_schedule.purchase_schedule_app.purchase_order_schedule",
	month_mapper: { Monthly: 1, Quarterly: 3, "Half Yearly": 6, Yearly: 12 },

	qty_precision(row) {
		return precision("qty", row) || 3;
	},

	open_dialog(frm, row, existing_rows) {
		const me = this;

		const dialog = new frappe.ui.Dialog({
			title: __("Purchase Receipt Schedule for {0}", [row.item_code]),
			size: "large",
			fields: [
				{
					fieldtype: "Date",
					fieldname: "schedule_date",
					label: __("First Required By Date"),
					reqd: 1,
					default:
						row.schedule_date || frm.doc.schedule_date || frappe.datetime.get_today(),
				},
				{
					fieldtype: "Float",
					fieldname: "qty",
					label: __("Qty"),
					read_only: 1,
					default: row.qty || 0,
				},
				{ fieldtype: "Column Break" },
				{
					fieldtype: "Select",
					fieldname: "frequency",
					label: __("Frequency"),
					options: "\nWeekly\nMonthly\nQuarterly\nHalf Yearly\nYearly",
				},
				{
					fieldtype: "Int",
					fieldname: "no_of_receipts",
					label: __("No of Receipts"),
				},
				{ fieldtype: "Section Break" },
				{
					fieldtype: "Button",
					fieldname: "get_purchase_schedule",
					label: __("Get Purchase Receipt Schedule"),
					click: () => {
						if (!row.uom) {
							me.generate_rows(dialog, row, 0);
							return;
						}
						frappe.db.get_value("UOM", row.uom, "must_be_whole_number", (r) => {
							me.generate_rows(dialog, row, cint(r && r.must_be_whole_number));
						});
					},
				},
				{
					fieldtype: "Table",
					fieldname: "purchase_schedule",
					label: __("Purchase Receipt Schedule"),
					data: [],
					fields: [
						{
							fieldtype: "Date",
							fieldname: "schedule_date",
							label: __("Required By"),
							reqd: 1,
							in_list_view: 1,
						},
						{
							fieldtype: "Float",
							fieldname: "qty",
							label: __("Qty"),
							reqd: 1,
							in_list_view: 1,
						},
						{
							// "name" is reserved by the grid for its own row ids
							fieldtype: "Data",
							fieldname: "schedule_name",
							label: __("Schedule ID"),
							read_only: 1,
						},
					],
				},
			],
			primary_action_label: __("Add Schedule"),
			primary_action: (values) => me.save(frm, row, dialog, values),
		});

		dialog.show();

		(existing_rows || []).forEach((d) => {
			dialog.fields_dict.purchase_schedule.df.data.push({
				schedule_date: d.schedule_date,
				qty: d.qty,
				schedule_name: d.name,
			});
		});
		dialog.fields_dict.purchase_schedule.refresh();
	},

	generate_rows(dialog, row, must_be_whole_number) {
		let schedule_date = dialog.get_value("schedule_date");
		const frequency = dialog.get_value("frequency");
		const no_of_receipts = cint(dialog.get_value("no_of_receipts"));

		if (!frequency) {
			frappe.throw(__("Please select a frequency for the purchase receipt schedule"));
		}
		if (!schedule_date) {
			frappe.throw(__("Please enter the first Required By date"));
		}
		if (no_of_receipts <= 0) {
			frappe.throw(__("Please enter a valid number of receipts"));
		}

		const prec = this.qty_precision(row);
		const qty_per_receipt = flt(row.qty) / no_of_receipts;
		let qty_left = flt(row.qty);
		const data = [];

		for (let i = 0; i < no_of_receipts; i++) {
			const is_last = i === no_of_receipts - 1;
			let qty;

			if (is_last) {
				qty = flt(qty_left, prec);
			} else {
				qty = must_be_whole_number
					? cint(qty_per_receipt)
					: flt(qty_per_receipt, prec);
				qty_left -= qty;
			}

			data.push({ schedule_date, qty });

			if (!is_last) {
				schedule_date =
					frequency === "Weekly"
						? frappe.datetime.add_days(schedule_date, 7)
						: frappe.datetime.add_months(schedule_date, this.month_mapper[frequency]);
			}
		}

		dialog.fields_dict.purchase_schedule.df.data = data;
		dialog.fields_dict.purchase_schedule.refresh();
	},

	save(frm, row, dialog, values) {
		const rows = (values.purchase_schedule || []).filter((d) => d.schedule_date || d.qty);

		if (!rows.length) {
			frappe.throw(__("Please enter at least one Required By date and quantity"));
		}

		let total_qty = 0;
		rows.forEach((d) => {
			if (!flt(d.qty)) {
				frappe.throw(__("Please enter a valid quantity"));
			}
			total_qty += flt(d.qty);
		});

		if (flt(total_qty, this.qty_precision(row)) > flt(row.qty)) {
			frappe.throw(
				__("Total quantity in purchase receipt schedule cannot be greater than the item quantity")
			);
		}

		frappe.call({
			method: `${this.api}.create_purchase_schedule`,
			type: "POST",
			args: {
				purchase_order: frm.doc.name,
				purchase_order_item: row.name,
				schedules: rows.map((d) => ({
					schedule_date: d.schedule_date,
					qty: d.qty,
					name: d.schedule_name,
				})),
			},
			freeze: true,
			freeze_message: __("Creating Purchase Receipt Schedule..."),
			callback: (r) => {
				if (!r.exc) {
					dialog.hide();
					frm.reload_doc();
				}
			},
		});
	},

	// Keep the "Add Schedule" column in the items grid even when the user's column
	// settings (grid ⚙) leave it out. Patches this grid instance once; returns true
	// the first time, so the caller rebuilds the already-rendered columns.
	pin_column(grid) {
		if (grid.__add_schedule_pinned) return false;
		grid.__add_schedule_pinned = true;

		const setup_user_defined_columns = grid.setup_user_defined_columns;
		grid.setup_user_defined_columns = function () {
			setup_user_defined_columns.call(this);

			// no user settings: the grid falls back to in_list_view, which includes it
			const columns = this.user_defined_columns || [];
			if (!columns.length || columns.some((d) => d.fieldname === "add_schedule")) {
				return;
			}

			const df = this.docfields.find((d) => d.fieldname === "add_schedule");
			if (df) {
				df.in_list_view = 1;
				columns.push(df);
			}
		};

		return true;
	},

	// Opens the schedule dialog for one item row, loaded with its saved schedule.
	open_for_row(frm, row) {
		if (frm.doc.docstatus === 2) {
			frappe.throw(__("Cannot add a purchase receipt schedule to a cancelled Purchase Order."));
		}
		if (frm.is_new() || row.__islocal || frm.is_dirty()) {
			frappe.throw(__("Please save the Purchase Order before adding a purchase receipt schedule."));
		}

		frappe.call({
			method: `${this.api}.get_purchase_schedule`,
			args: { purchase_order: frm.doc.name, purchase_order_item: row.name },
			callback: (r) => this.open_dialog(frm, row, r.message || []),
		});
	},
};

frappe.ui.form.on("Purchase Order", {
	onload(frm) {
		const list = frm.ignore_doctypes_on_cancel_all || [];
		if (!list.includes(purchase_schedule.po_schedule.doctype)) {
			frm.ignore_doctypes_on_cancel_all = list.concat([purchase_schedule.po_schedule.doctype]);
		}
	},

	refresh(frm) {
		const grid = frm.fields_dict.items.grid;
		const hidden = frm.is_new() || frm.doc.docstatus === 2 ? 1 : 0;
		const df = grid.docfields.find((d) => d.fieldname === "add_schedule");
		let needs_reset = purchase_schedule.po_schedule.pin_column(grid);

		if (df && cint(df.hidden) !== hidden) {
			df.hidden = hidden; // update_docfield_property skips this before rows render
			grid.update_docfield_property("add_schedule", "hidden", hidden);
			needs_reset = true;
		}

		// The grid caches its visible columns; rebuild them so the button column
		// appears right after the first save (and disappears on cancel).
		if (needs_reset) {
			grid.reset_grid();
		}
	},
});

frappe.ui.form.on("Purchase Order Item", {
	add_schedule(frm, cdt, cdn) {
		purchase_schedule.po_schedule.open_for_row(frm, locals[cdt][cdn]);
	},
});
