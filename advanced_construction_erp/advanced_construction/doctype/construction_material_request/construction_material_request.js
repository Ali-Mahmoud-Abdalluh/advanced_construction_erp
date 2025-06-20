// Copyright (c) 2023, Your Company and contributors
// For license information, please see license.txt

frappe.ui.form.on('Construction Material Request', {
	refresh: function(frm) {
		// Add custom buttons based on document state
		if (frm.doc.docstatus === 1) { // Submitted
			// Approval buttons
			if (frm.doc.approval_status === "Pending") {
				frm.add_custom_button(__('Approve'), function() {
					frappe.confirm(
						__('Are you sure you want to approve this Material Request?'),
						function() {
							frm.call({
								doc: frm.doc,
								method: 'approve',
								callback: function(r) {
									if (r.message) {
										frm.reload_doc();
									}
								}
							});
						}
					);
				}, __('Actions'));
				
				frm.add_custom_button(__('Reject'), function() {
					var d = new frappe.ui.Dialog({
						title: __('Reject Material Request'),
						fields: [
							{
								label: __('Rejection Reason'),
								fieldname: 'rejection_reason',
								fieldtype: 'Small Text',
								reqd: 1
							}
						],
						primary_action_label: __('Reject'),
						primary_action: function() {
							var values = d.get_values();
							if (values) {
								frm.call({
									doc: frm.doc,
									method: 'reject',
									args: {
										rejection_reason: values.rejection_reason
									},
									callback: function(r) {
										if (r.message) {
											d.hide();
											frm.reload_doc();
										}
									}
								});
							}
						}
					});
					d.show();
				}, __('Actions'));
			}
			
			// Create Material Request button
			if (frm.doc.approval_status === "Approved" && ["Approved", "Ordered"].includes(frm.doc.status)) {
				frm.add_custom_button(__('Create Material Request'), function() {
					frappe.confirm(
						__('This will create a Material Request in ERPNext. Continue?'),
						function() {
							frm.call({
								doc: frm.doc,
								method: 'create_material_request',
								callback: function(r) {
									if (r.message) {
										frappe.msgprint(__("Material Request {0} created", [r.message]));
										frm.reload_doc();
									}
								}
							});
						}
					);
				}, __('Create'));
			}
		}
		
		// Set indicator color based on status
		if (frm.doc.status) {
			frm.set_indicator_formatter('status', function(doc) {
				let colors = {
					'Draft': 'gray',
					'Submitted': 'blue',
					'Approved': 'green',
					'Rejected': 'red',
					'Ordered': 'orange',
					'Received': 'green',
					'Cancelled': 'red'
				};
				return colors[doc.status] || 'gray';
			});
		}
	},
	
	construction_project: function(frm) {
		// When construction project is selected, try to fetch the linked ERPNext project
		if (frm.doc.construction_project) {
			frappe.db.get_value('Construction Project', frm.doc.construction_project, 'erpnext_project', function(r) {
				if (r && r.erpnext_project) {
					frm.set_value('project', r.erpnext_project);
				}
			});
		}
	},
	
	project: function(frm) {
		// When ERPNext project is selected, try to fetch the linked Construction project if not already set
		if (frm.doc.project && !frm.doc.construction_project) {
			frappe.db.get_value('Construction Project', {erpnext_project: frm.doc.project}, 'name', function(r) {
				if (r && r.name) {
					frm.set_value('construction_project', r.name);
				}
			});
		}
	}
});

frappe.ui.form.on('Construction Material Request Item', {
	material: function(frm, cdt, cdn) {
		var row = locals[cdt][cdn];
		
		// Fetch material details
		if (row.material) {
			frappe.db.get_value('Construction Material', row.material, 
				['material_name', 'description', 'unit_of_measure', 'standard_rate', 'currency', 'default_warehouse', 'item'], 
				function(r) {
					if (r) {
						frappe.model.set_value(cdt, cdn, 'material_name', r.material_name);
						frappe.model.set_value(cdt, cdn, 'description', r.description);
						frappe.model.set_value(cdt, cdn, 'uom', r.unit_of_measure);
						frappe.model.set_value(cdt, cdn, 'estimated_price', r.standard_rate);
						frappe.model.set_value(cdt, cdn, 'currency', r.currency);
						frappe.model.set_value(cdt, cdn, 'warehouse', r.default_warehouse);
						frappe.model.set_value(cdt, cdn, 'item', r.item);
						
						// If item is set, fetch item name
						if (r.item) {
							frappe.db.get_value('Item', r.item, 'item_name', function(item_r) {
								if (item_r) {
									frappe.model.set_value(cdt, cdn, 'item_name', item_r.item_name);
								}
							});
						}
					}
				}
			);
		}
	},
	
	quantity: function(frm, cdt, cdn) {
		var row = locals[cdt][cdn];
		calculate_amount(frm, row);
	},
	
	estimated_price: function(frm, cdt, cdn) {
		var row = locals[cdt][cdn];
		calculate_amount(frm, row);
	},
	
	items_remove: function(frm, cdt, cdn) {
		// Recalculate totals when an item is removed
		frm.trigger('calculate_totals');
	}
});

// Helper function to calculate amount
function calculate_amount(frm, row) {
	if (row.quantity && row.estimated_price) {
		frappe.model.set_value(row.doctype, row.name, 'estimated_amount', row.quantity * row.estimated_price);
		frm.trigger('calculate_totals');
	}
}