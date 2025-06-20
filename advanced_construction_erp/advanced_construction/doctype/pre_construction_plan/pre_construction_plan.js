// Copyright (c) 2023, Your Organization and contributors
// For license information, please see license.txt

frappe.ui.form.on('Pre Construction Plan', {
	refresh: function(frm) {
		// Add custom buttons
		if (frm.doc.docstatus === 1) {
			frm.add_custom_button(__('Create Construction Project'), function() {
				frappe.model.open_mapped_doc({
					method: "advanced_construction_erp.pre_construction.doctype.pre_construction_plan.pre_construction_plan.make_construction_project",
					frm: frm
				});
			}, __('Create'));
			
			frm.add_custom_button(__('Create Project Budget'), function() {
				frappe.model.open_mapped_doc({
					method: "advanced_construction_erp.pre_construction.doctype.pre_construction_plan.pre_construction_plan.make_project_budget",
					frm: frm
				});
			}, __('Create'));
			
			frm.add_custom_button(__('Create Bill of Quantities'), function() {
				frappe.model.open_mapped_doc({
					method: "advanced_construction_erp.pre_construction.doctype.pre_construction_plan.pre_construction_plan.make_bill_of_quantities",
					frm: frm
				});
			}, __('Create'));
		}
		
		// View related documents
		if (frm.doc.site_feasibility_analysis) {
			frm.add_custom_button(__('View Site Feasibility Analysis'), function() {
				frappe.set_route("Form", "Site Feasibility Analysis", frm.doc.site_feasibility_analysis);
			}, __('View'));
		}
		
		if (frm.doc.opportunity) {
			frm.add_custom_button(__('View Opportunity'), function() {
				frappe.set_route("Form", "Construction Opportunity", frm.doc.opportunity);
			}, __('View'));
		}
		
		// Update the dashboard with phase completion status
		update_dashboard(frm);
	},
	
	onload: function(frm) {
		// Default values for new documents
		if (frm.doc.__islocal) {
			frm.set_value('plan_date', frappe.datetime.get_today());
			frm.set_value('status', 'Draft');
		}
	},
	
	validate: function(frm) {
		// Calculate overall completion percentage
		calculate_overall_completion(frm);
	},
	
	site_survey_completion: function(frm) {
		calculate_overall_completion(frm);
	},
	
	permits_approvals_completion: function(frm) {
		calculate_overall_completion(frm);
	},
	
	design_drawings_completion: function(frm) {
		calculate_overall_completion(frm);
	},
	
	resource_planning_completion: function(frm) {
		calculate_overall_completion(frm);
	},
	
	preliminary_schedule_completion: function(frm) {
		calculate_overall_completion(frm);
	},
	
	risk_assessment_completion: function(frm) {
		calculate_overall_completion(frm);
	},
	
	procurement_strategy_completion: function(frm) {
		calculate_overall_completion(frm);
	},
	
	stakeholder_communication_completion: function(frm) {
		calculate_overall_completion(frm);
	}
});

// Calculate the overall completion percentage
function calculate_overall_completion(frm) {
	const phases = [
		'site_survey_completion',
		'permits_approvals_completion',
		'design_drawings_completion',
		'resource_planning_completion',
		'preliminary_schedule_completion',
		'risk_assessment_completion',
		'procurement_strategy_completion',
		'stakeholder_communication_completion'
	];
	
	let total = 0;
	let completed = 0;
	
	phases.forEach(phase => {
		if (frm.doc[phase] !== undefined && frm.doc[phase] !== null) {
			total += 100;
			completed += parseFloat(frm.doc[phase]);
		}
	});
	
	const overall_completion = total > 0 ? Math.round(completed / total * 100) : 0;
	frm.set_value('overall_completion', overall_completion);
	
	// Update status based on completion
	if (overall_completion === 100) {
		frm.set_value('status', 'Completed');
	} else if (overall_completion > 0) {
		frm.set_value('status', 'In Progress');
	}
}

// Update dashboard with phase completion indicators
function update_dashboard(frm) {
	if (frm.doc.overall_completion !== undefined) {
		let color = 'red';
		if (frm.doc.overall_completion >= 80) {
			color = 'green';
		} else if (frm.doc.overall_completion >= 40) {
			color = 'orange';
		}
		
		frm.dashboard.add_indicator(__('Overall Completion: {0}%', [frm.doc.overall_completion]), color);
	}
	
	// Add timeline for target completion
	if (frm.doc.target_completion_date) {
		const today = frappe.datetime.get_today();
		const target_date = frm.doc.target_completion_date;
		const diff_days = frappe.datetime.get_diff(target_date, today);
		
		let timeline_color = 'green';
		let timeline_message = __('On Track');
		
		if (diff_days < 0) {
			timeline_color = 'red';
			timeline_message = __('Overdue by {0} days', [Math.abs(diff_days)]);
		} else if (diff_days < 7) {
			timeline_color = 'orange';
			timeline_message = __('Due in {0} days', [diff_days]);
		} else {
			timeline_message = __('Due in {0} days', [diff_days]);
		}
		
		frm.dashboard.add_indicator(timeline_message, timeline_color);
	}
} 