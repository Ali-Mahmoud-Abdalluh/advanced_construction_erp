// Copyright (c) 2023, Your Organization and contributors
// For license information, please see license.txt

frappe.ui.form.on('Construction Lead', {
	refresh: function(frm) {
		// Add custom buttons
		if (frm.doc.status !== 'Converted' && frm.doc.status !== 'Closed') {
			frm.add_custom_button(__('Convert to Opportunity'), function() {
				frappe.model.open_mapped_doc({
					method: "advanced_construction_erp.pre_construction.doctype.construction_lead.construction_lead.make_opportunity",
					frm: frm
				});
			}, __('Actions'));
		}

		// Add dashboard information
		frm.dashboard.add_indicator(
			frm.doc.status === 'Open' ? __("Open") : 
			frm.doc.status === 'Qualified' ? __("Qualified") : 
			frm.doc.status === 'Converted' ? __("Converted") : __("Closed"), 
			frm.doc.status === 'Open' ? 'blue' : 
			frm.doc.status === 'Qualified' ? 'green' : 
			frm.doc.status === 'Converted' ? 'green' : 'red'
		);

		// Enable/disable fields based on status
		if (frm.doc.status === 'Converted' || frm.doc.status === 'Closed') {
			frm.set_df_property('lead_details_section', 'read_only', 1);
		}
	},
    
	validate: function(frm) {
		// Validate required fields
		if (!frm.doc.contact_person && !frm.doc.company_name) {
			frappe.throw(__("Either Contact Person or Company Name is required"));
		}
	},
    
	project_type: function(frm) {
		// Handle project type change
		if (frm.doc.project_type) {
			// Load predefined questions for this project type
			frappe.call({
				method: "advanced_construction_erp.pre_construction.doctype.construction_lead.construction_lead.get_project_type_details",
				args: {
					project_type: frm.doc.project_type
				},
				callback: function(r) {
					if (r.message) {
						frm.set_value('estimated_budget', r.message.typical_budget);
						frm.set_value('typical_duration', r.message.typical_duration);
					}
				}
			});
		}
	},
    
	follow_up_date: function(frm) {
		// Create a calendar event for follow-up
		if (frm.doc.follow_up_date) {
			frm.add_custom_button(__('Schedule Follow-up'), function() {
				frappe.new_doc('Event', {
					subject: 'Follow-up for ' + frm.doc.lead_name,
					starts_on: frm.doc.follow_up_date,
					description: 'Follow-up with ' + frm.doc.lead_name + ' regarding ' + frm.doc.project_description
				});
			});
		}
	}
}); 