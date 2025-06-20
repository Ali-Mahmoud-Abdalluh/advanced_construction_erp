frappe.ui.form.on('Feasibility Study', {
	refresh: function(frm) {
		// Add custom buttons
		if (frm.doc.status === "Completed" && !frm.doc.overall_feasibility_conclusion) {
			frm.add_custom_button(__('Generate Conclusion'), function() {
				generate_conclusion(frm);
			});
		}
		
		if (frm.doc.overall_feasibility_conclusion === "Highly Feasible" || 
			frm.doc.overall_feasibility_conclusion === "Feasible") {
			frm.add_custom_button(__('Create Project Estimation'), function() {
				frappe.model.open_mapped_doc({
					method: "advanced_construction_erp.pre_construction.doctype.feasibility_study.feasibility_study.make_project_estimation",
					frm: frm
				});
			}, __('Create'));
		}
		
		// Set up dashboard indicators
		if (frm.doc.overall_risk_assessment) {
			let risk_color = "green";
			if (frm.doc.overall_risk_assessment === "Very High Risk" || 
				frm.doc.overall_risk_assessment === "High Risk") {
				risk_color = "red";
			} else if (frm.doc.overall_risk_assessment === "Moderate Risk") {
				risk_color = "orange";
			}
			
			frm.dashboard.add_indicator(
				__("Risk Assessment") + ": " + __(frm.doc.overall_risk_assessment),
				risk_color
			);
		}
		
		if (frm.doc.overall_feasibility_conclusion) {
			let conclusion_color = "red";
			if (frm.doc.overall_feasibility_conclusion === "Highly Feasible") {
				conclusion_color = "green";
			} else if (frm.doc.overall_feasibility_conclusion === "Feasible") {
				conclusion_color = "blue";
			} else if (frm.doc.overall_feasibility_conclusion === "Marginally Feasible") {
				conclusion_color = "orange";
			}
			
			frm.dashboard.add_indicator(
				__("Conclusion") + ": " + __(frm.doc.overall_feasibility_conclusion),
				conclusion_color
			);
		}
		
		// Add financial metrics to dashboard
		if (frm.doc.roi || frm.doc.irr || frm.doc.npv) {
			let metrics_html = "<div class='row'><div class='col-sm-4'><b>ROI:</b> " + 
				(frm.doc.roi ? frm.doc.roi + "%" : "N/A") + 
				"</div><div class='col-sm-4'><b>IRR:</b> " + 
				(frm.doc.irr ? frm.doc.irr + "%" : "N/A") + 
				"</div><div class='col-sm-4'><b>NPV:</b> " + 
				(frm.doc.npv ? format_currency(frm.doc.npv, frm.doc.currency) : "N/A") + 
				"</div></div>";
			
			frm.dashboard.add_section(metrics_html, __('Financial Metrics'));
		}
	},
	
	// Calculate total project cost
	land_acquisition_cost: function(frm) { calculate_total_cost(frm); },
	design_cost: function(frm) { calculate_total_cost(frm); },
	construction_cost: function(frm) { calculate_total_cost(frm); },
	equipment_cost: function(frm) { calculate_total_cost(frm); },
	permit_fees: function(frm) { calculate_total_cost(frm); },
	contingency_cost: function(frm) { calculate_total_cost(frm); },
	other_costs: function(frm) { calculate_total_cost(frm); },
	
	// Validate dates
	validate: function(frm) {
		// Validate expected start and completion dates
		if (frm.doc.expected_start_date && frm.doc.expected_completion_date) {
			if (frappe.datetime.str_to_obj(frm.doc.expected_completion_date) < 
				frappe.datetime.str_to_obj(frm.doc.expected_start_date)) {
				frappe.msgprint(__("Expected completion date cannot be before expected start date"));
				frappe.validated = false;
			}
		}
		
		// Validate financial metrics
		if (frm.doc.roi && (frm.doc.roi < -100 || frm.doc.roi > 1000)) {
			frappe.msgprint(__("ROI value seems unusual. Please verify."));
		}
		
		if (frm.doc.irr && (frm.doc.irr < -100 || frm.doc.irr > 1000)) {
			frappe.msgprint(__("IRR value seems unusual. Please verify."));
		}
	},
	
	// Update status based on completion of study
	after_save: function(frm) {
		// Check if all required sections for completion are filled
		let completion_fields = [
			'market_demand_analysis', 'site_suitability', 'total_project_cost',
			'projected_revenue', 'roi', 'overall_risk_assessment'
		];
		
		let all_completed = true;
		for (let field of completion_fields) {
			if (!frm.doc[field]) {
				all_completed = false;
				break;
			}
		}
		
		// Suggest status update if all fields are completed but status is still In Progress
		if (all_completed && frm.doc.status === "In Progress") {
			frappe.confirm(
				__('All major sections appear to be completed. Update status to "Completed"?'),
				function() {
					frm.set_value('status', 'Completed');
					frm.save();
				}
			);
		}
		
		// Suggest generating conclusion if status is Completed but no conclusion is made
		if (frm.doc.status === "Completed" && !frm.doc.overall_feasibility_conclusion) {
			frappe.confirm(
				__('Would you like to generate the feasibility conclusion now?'),
				function() {
					generate_conclusion(frm);
				}
			);
		}
	}
});

// Helper function to calculate total project cost
function calculate_total_cost(frm) {
	let total = 0;
	let cost_fields = [
		'land_acquisition_cost', 'design_cost', 'construction_cost', 
		'equipment_cost', 'permit_fees', 'contingency_cost', 'other_costs'
	];
	
	for (let field of cost_fields) {
		if (frm.doc[field]) {
			total += frm.doc[field];
		}
	}
	
	frm.set_value('total_project_cost', total);
}

// Helper function to generate conclusion based on individual assessments
function generate_conclusion(frm) {
	// Get all conclusion fields
	let conclusion_fields = [
		'technical_feasibility_conclusion', 
		'financial_feasibility_conclusion',
		'market_feasibility_conclusion',
		'legal_feasibility_conclusion',
		'timeline_feasibility_conclusion'
	];
	
	// Check if all conclusion fields are filled
	let missing_fields = [];
	for (let field of conclusion_fields) {
		if (!frm.doc[field]) {
			missing_fields.push(frappe.meta.get_label(frm.doctype, field));
		}
	}
	
	if (missing_fields.length > 0) {
		frappe.msgprint(__("Please complete the following conclusions first: ") + missing_fields.join(", "));
		return;
	}
	
	// Calculate overall conclusion based on individual conclusions
	let conclusion_values = {
		"Highly Feasible": 4,
		"Feasible": 3,
		"Marginally Feasible": 2,
		"Not Feasible": 1
	};
	
	let total_value = 0;
	for (let field of conclusion_fields) {
		total_value += conclusion_values[frm.doc[field]];
	}
	
	let avg_value = total_value / conclusion_fields.length;
	let overall_conclusion = "";
	
	if (avg_value >= 3.5) {
		overall_conclusion = "Highly Feasible";
	} else if (avg_value >= 2.5) {
		overall_conclusion = "Feasible";
	} else if (avg_value >= 1.5) {
		overall_conclusion = "Marginally Feasible";
	} else {
		overall_conclusion = "Not Feasible";
	}
	
	// Check if any individual conclusion is "Not Feasible"
	let has_not_feasible = false;
	for (let field of conclusion_fields) {
		if (frm.doc[field] === "Not Feasible") {
			has_not_feasible = true;
			break;
		}
	}
	
	// If any conclusion is "Not Feasible", cap the overall at "Marginally Feasible"
	if (has_not_feasible && overall_conclusion === "Highly Feasible") {
		overall_conclusion = "Feasible";
	} else if (has_not_feasible && overall_conclusion === "Feasible") {
		overall_conclusion = "Marginally Feasible";
	}
	
	// Set the overall conclusion
	frm.set_value('overall_feasibility_conclusion', overall_conclusion);
	
	// Generate recommendation text
	let recommendation = "<p><strong>Summary of Findings:</strong></p><ul>";
	for (let field of conclusion_fields) {
		let label = frappe.meta.get_label(frm.doctype, field);
		recommendation += "<li>" + label + ": " + frm.doc[field] + "</li>";
	}
	recommendation += "</ul>";
	
	recommendation += "<p><strong>Overall Conclusion:</strong> " + overall_conclusion + "</p>";
	
	if (overall_conclusion === "Highly Feasible" || overall_conclusion === "Feasible") {
		recommendation += "<p><strong>Recommendation:</strong> Proceed with the project. ";
		if (overall_conclusion === "Feasible") {
			recommendation += "Address any concerns identified in the individual assessments.";
		}
		recommendation += "</p>";
	} else if (overall_conclusion === "Marginally Feasible") {
		recommendation += "<p><strong>Recommendation:</strong> Proceed with caution. Address all identified issues before committing resources. Consider project modifications to improve feasibility.</p>";
	} else {
		recommendation += "<p><strong>Recommendation:</strong> Do not proceed with the project in its current form. Major revisions or reconsideration of the project scope is required.</p>";
	}
	
	frm.set_value('recommendation', recommendation);
	frm.save();
}