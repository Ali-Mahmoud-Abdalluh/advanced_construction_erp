// Copyright (c) 2023, Your Organization and contributors
// For license information, please see license.txt

frappe.ui.form.on('Construction Opportunity', {
	refresh: function(frm) {
		// Add custom buttons
		if (frm.doc.status === "Open") {
			frm.add_custom_button(__('Create Feasibility Study'), function() {
				frappe.model.open_mapped_doc({
					method: "advanced_construction_erp.pre_construction.doctype.construction_opportunity.construction_opportunity.make_feasibility_study",
					frm: frm
				});
			}, __('Create'));
			
			frm.add_custom_button(__('Create Project Budget'), function() {
				frappe.model.open_mapped_doc({
					method: "advanced_construction_erp.pre_construction.doctype.construction_opportunity.construction_opportunity.make_project_budget",
					frm: frm
				});
			}, __('Create'));
		}
		
		if (frm.doc.status === "Qualified") {
			frm.add_custom_button(__('Create Construction Project'), function() {
				frappe.model.open_mapped_doc({
					method: "advanced_construction_erp.pre_construction.doctype.construction_opportunity.construction_opportunity.make_construction_project",
					frm: frm
				});
			}, __('Create'));
		}
		
		// Add competition analysis button
		frm.add_custom_button(__('Competition Analysis'), function() {
			frappe.set_route('query-report', 'Construction Competition Analysis', {
				opportunity: frm.doc.name
			});
		});
		
		// Add dashboard indicators
		frm.dashboard.add_indicator(
			frm.doc.status === 'Open' ? __("Open") : 
			frm.doc.status === 'Qualified' ? __("Qualified") : 
			frm.doc.status === 'Won' ? __("Won") : 
			frm.doc.status === 'Lost' ? __("Lost") : __("Closed"), 
			frm.doc.status === 'Open' ? 'blue' : 
			frm.doc.status === 'Qualified' ? 'green' : 
			frm.doc.status === 'Won' ? 'green' : 'red'
		);
		
		// Update probability indicator
		if(frm.doc.probability) {
			let color;
			if(frm.doc.probability < 25) color = 'red';
			else if(frm.doc.probability < 50) color = 'orange';
			else if(frm.doc.probability < 75) color = 'yellow';
			else color = 'green';
			
			frm.dashboard.add_indicator(__('Probability: {0}%', [frm.doc.probability]), color);
		}
	},
	
	validate: function(frm) {
		// Calculate forecasted revenue
		frm.set_value('forecasted_revenue', frm.doc.estimated_budget * (frm.doc.probability / 100));
	},
	
	estimated_budget: function(frm) {
		// Recalculate forecasted revenue when budget changes
		frm.set_value('forecasted_revenue', frm.doc.estimated_budget * (frm.doc.probability / 100));
	},
	
	probability: function(frm) {
		// Recalculate forecasted revenue when probability changes
		frm.set_value('forecasted_revenue', frm.doc.estimated_budget * (frm.doc.probability / 100));
	},
	
	project_type: function(frm) {
		// Update probability based on historical success with project type
		frappe.call({
			method: "advanced_construction_erp.pre_construction.doctype.construction_opportunity.construction_opportunity.get_historical_probability",
			args: {
				project_type: frm.doc.project_type
			},
			callback: function(r) {
				if (r.message) {
					frm.set_value('probability', r.message);
				}
			}
		});
	}
}); 