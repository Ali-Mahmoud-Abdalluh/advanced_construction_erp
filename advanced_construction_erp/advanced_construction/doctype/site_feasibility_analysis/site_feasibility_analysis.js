// Copyright (c) 2023, Your Organization and contributors
// For license information, please see license.txt

frappe.ui.form.on('Site Feasibility Analysis', {
	refresh: function(frm) {
		// Add custom buttons
		if(frm.doc.docstatus === 1) {
			frm.add_custom_button(__('Create Pre-Construction Plan'), function() {
				frappe.model.open_mapped_doc({
					method: "advanced_construction_erp.pre_construction.doctype.site_feasibility_analysis.site_feasibility_analysis.make_pre_construction_plan",
					frm: frm
				});
			}, __('Create'));
		}
		
		// Add feasibility score indicator
		if(frm.doc.feasibility_score) {
			let color;
			if(frm.doc.feasibility_score < 40) color = 'red';
			else if(frm.doc.feasibility_score < 70) color = 'orange';
			else color = 'green';
			
			frm.dashboard.add_indicator(__('Feasibility Score: {0}', [frm.doc.feasibility_score]), color);
		}
		
		// Add view on map button
		if(frm.doc.site_coordinates) {
			frm.add_custom_button(__('View on Map'), function() {
				frappe.ui.get_map(frm.doc.site_coordinates, frm.doc.site_location);
			});
		}
	},
	
	onload: function(frm) {
		// Set default values for new documents
		if(frm.doc.__islocal) {
			frm.set_value('analysis_date', frappe.datetime.get_today());
		}
	},
	
	validate: function(frm) {
		// Calculate feasibility score
		calculate_feasibility_score(frm);
	},
	
	technical_feasibility: function(frm) {
		calculate_feasibility_score(frm);
	},
	
	financial_feasibility: function(frm) {
		calculate_feasibility_score(frm);
	},
	
	legal_feasibility: function(frm) {
		calculate_feasibility_score(frm);
	},
	
	environmental_feasibility: function(frm) {
		calculate_feasibility_score(frm);
	},
	
	social_feasibility: function(frm) {
		calculate_feasibility_score(frm);
	}
});

// Calculate the overall feasibility score
function calculate_feasibility_score(frm) {
	// Set defaults if not provided
	if(!frm.doc.technical_feasibility) frm.set_value('technical_feasibility', 0);
	if(!frm.doc.financial_feasibility) frm.set_value('financial_feasibility', 0);
	if(!frm.doc.legal_feasibility) frm.set_value('legal_feasibility', 0);
	if(!frm.doc.environmental_feasibility) frm.set_value('environmental_feasibility', 0);
	if(!frm.doc.social_feasibility) frm.set_value('social_feasibility', 0);
	
	// Calculate weighted score
	const weights = {
		technical: 0.25,
		financial: 0.3,
		legal: 0.2,
		environmental: 0.15,
		social: 0.1
	};
	
	const score = (
		frm.doc.technical_feasibility * weights.technical +
		frm.doc.financial_feasibility * weights.financial +
		frm.doc.legal_feasibility * weights.legal +
		frm.doc.environmental_feasibility * weights.environmental +
		frm.doc.social_feasibility * weights.social
	);
	
	frm.set_value('feasibility_score', Math.round(score));
	
	// Update recommendation based on score
	let recommendation = '';
	if(score < 40) {
		recommendation = 'Not Feasible - Significant issues found';
	} else if(score < 60) {
		recommendation = 'Marginally Feasible - Major concerns need to be addressed';
	} else if(score < 80) {
		recommendation = 'Feasible with Conditions - Some concerns need to be addressed';
	} else {
		recommendation = 'Highly Feasible - Proceed with the project';
	}
	
	frm.set_value('recommendation', recommendation);
} 