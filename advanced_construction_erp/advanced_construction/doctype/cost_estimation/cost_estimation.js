// Copyright (c) 2024, Construction Management and contributors
// For license information, please see license.txt

frappe.ui.form.on('Cost Estimation', {
	refresh: function(frm) {
		set_status_indicator(frm);
		add_custom_buttons(frm);
		set_field_properties(frm);
	},

	estimation_date: function(frm) {
		if (frm.doc.estimation_date && frm.doc.estimation_date > frappe.datetime.get_today()) {
			frappe.msgprint(__('Estimation date cannot be in the future'));
			frm.set_value('estimation_date', frappe.datetime.get_today());
		}
	},

	status: function(frm) {
		set_status_indicator(frm);
		if (frm.doc.status === 'Approved' && !frm.doc.approved_by) {
			frm.set_value('approved_by', frappe.session.user);
		}
	},

	contingency_percentage: function(frm) {
		calculate_totals(frm);
	},

	profit_margin_percentage: function(frm) {
		calculate_totals(frm);
	},

	project: function(frm) {
		if (frm.doc.project) {
			fetch_project_details(frm);
		}
	}
});

frappe.ui.form.on('Cost Estimation Item', {
	quantity: function(frm, cdt, cdn) {
		calculate_item_amount(frm, cdt, cdn);
	},

	rate: function(frm, cdt, cdn) {
		calculate_item_amount(frm, cdt, cdn);
	},

	material_cost: function(frm, cdt, cdn) {
		calculate_item_total_cost(frm, cdt, cdn);
	},

	labor_cost: function(frm, cdt, cdn) {
		calculate_item_total_cost(frm, cdt, cdn);
	},

	equipment_cost: function(frm, cdt, cdn) {
		calculate_item_total_cost(frm, cdt, cdn);
	},

	overhead_cost: function(frm, cdt, cdn) {
		calculate_item_total_cost(frm, cdt, cdn);
	},

	waste_percentage: function(frm, cdt, cdn) {
		calculate_item_total_cost(frm, cdt, cdn);
	},

	category: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		if (row.category && !row.item_code) {
			// Auto-generate item code based on category
			let item_count = frm.doc.estimation_items.filter(item => item.category === row.category).length;
			frappe.model.set_value(cdt, cdn, 'item_code', `${row.category.toUpperCase()}-${String(item_count).padStart(3, '0')}`);
		}
	},

	estimation_items_remove: function(frm) {
		calculate_totals(frm);
	}
});

function set_status_indicator(frm) {
	let indicator_map = {
		'Draft': 'orange',
		'Under Review': 'yellow',
		'Approved': 'green',
		'Rejected': 'red',
		'Revision Required': 'blue'
	};
	
	if (frm.doc.status) {
		frm.dashboard.set_indicator(__(frm.doc.status), indicator_map[frm.doc.status] || 'gray');
	}
}

function add_custom_buttons(frm) {
	if (frm.doc.docstatus === 1) {
		// Add Duplicate button
		frm.add_custom_button(__('Duplicate Estimation'), function() {
			duplicate_estimation(frm);
		}, __('Actions'));

		// Add Compare with Budget button
		frm.add_custom_button(__('Compare with Budget'), function() {
			compare_with_budget(frm);
		}, __('Actions'));

		// Add Export to Excel button
		frm.add_custom_button(__('Export to Excel'), function() {
			export_to_excel(frm);
		}, __('Actions'));
	}

	if (frm.doc.status === 'Draft' && !frm.is_new()) {
		frm.add_custom_button(__('Submit for Review'), function() {
			frm.set_value('status', 'Under Review');
			frm.save();
		});
	}

	if (frm.doc.status === 'Under Review' && frappe.user.has_role('Construction Manager')) {
		frm.add_custom_button(__('Approve'), function() {
			frm.set_value('status', 'Approved');
			frm.set_value('approved_by', frappe.session.user);
			frm.save();
		});

		frm.add_custom_button(__('Reject'), function() {
			frm.set_value('status', 'Rejected');
			frm.save();
		});

		frm.add_custom_button(__('Request Revision'), function() {
			frm.set_value('status', 'Revision Required');
			frm.save();
		});
	}
}

function set_field_properties(frm) {
	// Make approved_by read-only if not Construction Manager
	if (!frappe.user.has_role('Construction Manager')) {
		frm.set_df_property('approved_by', 'read_only', 1);
	}

	// Hide certain fields based on status
	if (frm.doc.status === 'Approved') {
		frm.set_df_property('estimation_items', 'read_only', 1);
		frm.set_df_property('contingency_percentage', 'read_only', 1);
		frm.set_df_property('profit_margin_percentage', 'read_only', 1);
	}
}

function calculate_item_amount(frm, cdt, cdn) {
	let row = locals[cdt][cdn];
	let amount = flt(row.quantity) * flt(row.rate);
	frappe.model.set_value(cdt, cdn, 'amount', amount);
	calculate_totals(frm);
}

function calculate_item_total_cost(frm, cdt, cdn) {
	let row = locals[cdt][cdn];
	let base_cost = flt(row.material_cost) + flt(row.labor_cost) + flt(row.equipment_cost) + flt(row.overhead_cost);
	let waste_amount = base_cost * flt(row.waste_percentage) / 100;
	let total_cost = base_cost + waste_amount;
	frappe.model.set_value(cdt, cdn, 'total_cost', total_cost);
	calculate_totals(frm);
}

function calculate_totals(frm) {
	let total_material = 0;
	let total_labor = 0;
	let total_equipment = 0;
	let total_overhead = 0;
	let total_amount = 0;

	// Calculate totals from items
	frm.doc.estimation_items.forEach(function(item) {
		total_material += flt(item.material_cost);
		total_labor += flt(item.labor_cost);
		total_equipment += flt(item.equipment_cost);
		total_overhead += flt(item.overhead_cost);
		total_amount += flt(item.amount);
	});

	// Set category totals
	frm.set_value('total_material_cost', total_material);
	frm.set_value('total_labor_cost', total_labor);
	frm.set_value('total_equipment_cost', total_equipment);
	frm.set_value('total_overhead_cost', total_overhead);

	// Calculate contingency and profit
	let subtotal = total_amount;
	let contingency_amount = subtotal * flt(frm.doc.contingency_percentage) / 100;
	frm.set_value('contingency_amount', contingency_amount);
	
	let subtotal_with_contingency = subtotal + contingency_amount;
	let profit_amount = subtotal_with_contingency * flt(frm.doc.profit_margin_percentage) / 100;
	frm.set_value('profit_margin_amount', profit_amount);
	
	// Calculate final total
	let total_estimated_cost = subtotal_with_contingency + profit_amount;
	frm.set_value('total_estimated_cost', total_estimated_cost);
}

function fetch_project_details(frm) {
	frappe.call({
		method: 'frappe.client.get',
		args: {
			doctype: 'Construction Project',
			name: frm.doc.project
		},
		callback: function(r) {
			if (r.message) {
				frm.set_value('project_description', r.message.project_description);
				frm.set_value('scope_of_work', r.message.scope_of_work);
			}
		}
	});
}

function duplicate_estimation(frm) {
	frappe.call({
		method: 'duplicate_estimation',
		doc: frm.doc,
		callback: function(r) {
			if (r.message) {
				frappe.set_route('Form', 'Cost Estimation', r.message);
				frappe.show_alert(__('Estimation duplicated successfully'));
			}
		}
	});
}

function compare_with_budget(frm) {
	let d = new frappe.ui.Dialog({
		title: __('Compare with Budget'),
		fields: [
			{
				fieldtype: 'Link',
				fieldname: 'budget',
				label: __('Project Budget'),
				options: 'Project Budget',
				reqd: 1
			}
		],
		primary_action: function() {
			let values = d.get_values();
			if (values.budget) {
				frappe.call({
					method: 'compare_with_budget',
					doc: frm.doc,
					args: {
						budget_name: values.budget
					},
					callback: function(r) {
						if (r.message) {
							show_budget_comparison(r.message);
						}
					}
				});
				d.hide();
			}
		},
		primary_action_label: __('Compare')
	});
	d.show();
}

function show_budget_comparison(data) {
	let message = `
		<div class="budget-comparison">
			<h4>Budget Comparison Results</h4>
			<table class="table table-bordered">
				<tr><td><strong>Budget Amount:</strong></td><td>${format_currency(data.budget_amount)}</td></tr>
				<tr><td><strong>Estimated Amount:</strong></td><td>${format_currency(data.estimated_amount)}</td></tr>
				<tr><td><strong>Variance:</strong></td><td>${format_currency(data.variance)}</td></tr>
				<tr><td><strong>Variance %:</strong></td><td>${data.variance_percentage.toFixed(2)}%</td></tr>
				<tr><td><strong>Status:</strong></td><td><span class="indicator ${data.variance > 0 ? 'red' : data.variance < 0 ? 'green' : 'blue'}">${data.status}</span></td></tr>
			</table>
		</div>
	`;
	
	frappe.msgprint({
		title: __('Budget Comparison'),
		message: message,
		indicator: data.variance > 0 ? 'red' : 'green'
	});
}

function export_to_excel(frm) {
	frappe.call({
		method: 'frappe.desk.reportview.export_query',
		args: {
			doctype: 'Cost Estimation',
			file_format_type: 'Excel',
			filters: [['Cost Estimation', 'name', '=', frm.doc.name]]
		},
		callback: function(r) {
			if (r.message) {
				window.open(r.message.file_url);
			}
		}
	});
}