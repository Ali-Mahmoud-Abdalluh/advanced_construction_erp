// Copyright (c) 2023, Your Company and contributors
// For license information, please see license.txt

frappe.ui.form.on('Construction Site Safety', {
	refresh: function(frm) {
		// Set indicator color based on compliance status
		frm.set_indicator_formatter('compliance_status',
			function(doc) {
				let colors = {
					'Compliant': 'green',
					'Partially Compliant': 'orange',
					'Non-Compliant': 'red'
				};
				return colors[doc.compliance_status] || 'gray';
			}
		);
		
		// Add custom buttons
		if (frm.doc.docstatus === 1 && frm.doc.compliance_status !== 'Compliant') {
			frm.add_custom_button(__('Create Follow-up Inspection'), function() {
				frappe.call({
					method: 'create_and_get_follow_up_inspection',
					doc: frm.doc,
					callback: function(r) {
						if (r.message) {
							frappe.set_route('Form', 'Construction Site Safety', r.message);
						}
					}
				});
			}, __('Actions'));
		}
		
		// Add button to view construction site
		if (frm.doc.construction_site) {
			frm.add_custom_button(__('View Site'), function() {
				frappe.set_route('Form', 'Construction Site', frm.doc.construction_site);
			}, __('Actions'));
		}
		
		// Add print button for safety report
		frm.add_custom_button(__('Print Safety Report'), function() {
			frm.print_doc();
		}, __('Actions'));
		
		// Add dashboard for corrective actions
		if (frm.doc.corrective_actions && frm.doc.corrective_actions.length > 0) {
			let pending = 0;
			let completed = 0;
			let delayed = 0;
			
			frm.doc.corrective_actions.forEach(function(action) {
				if (action.status === 'Completed') {
					completed++;
				} else if (action.status === 'Delayed') {
					delayed++;
				} else if (['Pending', 'In Progress'].includes(action.status)) {
					pending++;
				}
			});
			
			frm.dashboard.add_indicator(__('Pending Actions: {0}', [pending]), pending > 0 ? 'orange' : 'green');
			frm.dashboard.add_indicator(__('Completed Actions: {0}', [completed]), 'green');
			frm.dashboard.add_indicator(__('Delayed Actions: {0}', [delayed]), delayed > 0 ? 'red' : 'green');
		}
	},
	
	construction_site: function(frm) {
		// When construction site is selected, fetch site name
		if (frm.doc.construction_site) {
			frappe.db.get_value('Construction Site', frm.doc.construction_site, 'site_name', function(r) {
				if (r && r.site_name) {
					frm.set_value('site_name', r.site_name);
				}
			});
		}
	},
	
	validate: function(frm) {
		// Validate that at least one hazard is identified if compliance status is not Compliant
		if (frm.doc.compliance_status !== 'Compliant' && 
			(!frm.doc.hazards_identified || frm.doc.hazards_identified.length === 0)) {
			frappe.msgprint({
				title: __('Validation'),
				indicator: 'red',
				message: __('Please identify at least one hazard for non-compliant inspection.')
			});
			validated = false;
		}
		
		// Validate that at least one corrective action is added if compliance status is not Compliant
		if (frm.doc.compliance_status !== 'Compliant' && 
			(!frm.doc.corrective_actions || frm.doc.corrective_actions.length === 0)) {
			frappe.msgprint({
				title: __('Validation'),
				indicator: 'red',
				message: __('Please add at least one corrective action for non-compliant inspection.')
			});
			validated = false;
		}
	}
});

// Child table handling for corrective actions
frappe.ui.form.on('Construction Site Safety Action', {
	status: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		
		// If status is changed to Completed, set completion date to today if not already set
		if (row.status === 'Completed' && !row.completion_date) {
			frappe.model.set_value(cdt, cdn, 'completion_date', frappe.datetime.get_today());
		}
	}
});