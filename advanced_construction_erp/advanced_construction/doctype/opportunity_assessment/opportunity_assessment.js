frappe.ui.form.on('Opportunity Assessment', {
	refresh: function(frm) {
		// Add custom buttons
		if (frm.doc.status === "Completed" && !frm.doc.go_no_go_decision) {
			frm.add_custom_button(__('Make Decision'), function() {
				frm.set_value('decision_date', frappe.datetime.get_today());
				frm.set_value('decision_by', frappe.session.user);
				frm.toggle_display('go_no_go_decision', true);
				frm.toggle_display('decision_rationale', true);
			});
		}
		
		if (frm.doc.go_no_go_decision === "Go" && frm.doc.status === "Approved") {
			frm.add_custom_button(__('Create Feasibility Study'), function() {
				frappe.model.open_mapped_doc({
					method: "advanced_construction_erp.pre_construction.doctype.opportunity_assessment.opportunity_assessment.make_feasibility_study",
					frm: frm
				});
			});
		}
		
		// Set up dashboard indicators
		frm.dashboard.add_indicator(
			frm.doc.overall_risk_rating === "Very High" || frm.doc.overall_risk_rating === "High" ? 
				__("High Risk") + ": " + __(frm.doc.overall_risk_rating) : 
				__("Risk Level") + ": " + __(frm.doc.overall_risk_rating),
			frm.doc.overall_risk_rating === "Very High" || frm.doc.overall_risk_rating === "High" ? "red" : 
			frm.doc.overall_risk_rating === "Medium" ? "orange" : "green"
		);
		
		frm.dashboard.add_indicator(
			frm.doc.overall_reward_rating === "Very High" || frm.doc.overall_reward_rating === "High" ? 
				__("High Reward") + ": " + __(frm.doc.overall_reward_rating) : 
				__("Reward Level") + ": " + __(frm.doc.overall_reward_rating),
			frm.doc.overall_reward_rating === "Very High" || frm.doc.overall_reward_rating === "High" ? "green" : 
			frm.doc.overall_reward_rating === "Medium" ? "orange" : "red"
		);
		
		// Set up score calculation
		if (frm.doc.status !== "Draft") {
			frm.add_custom_button(__('Recalculate Score'), function() {
				calculate_total_score(frm);
			});
		}
	},
	
	// Calculate total score when individual scores change
	financial_score: function(frm) { calculate_total_score(frm); },
	technical_score: function(frm) { calculate_total_score(frm); },
	strategic_score: function(frm) { calculate_total_score(frm); },
	resource_score: function(frm) { calculate_total_score(frm); },
	risk_score: function(frm) { calculate_total_score(frm); },
	
	// Validate scores are within range
	validate: function(frm) {
		validate_score_range(frm, 'financial_score');
		validate_score_range(frm, 'technical_score');
		validate_score_range(frm, 'strategic_score');
		validate_score_range(frm, 'resource_score');
		validate_score_range(frm, 'risk_score');
		
		// Validate decision date is not before assessment date
		if (frm.doc.decision_date && frm.doc.assessment_date) {
			if (frappe.datetime.str_to_obj(frm.doc.decision_date) < 
				frappe.datetime.str_to_obj(frm.doc.assessment_date)) {
				frappe.msgprint(__("Decision date cannot be before assessment date"));
				frappe.validated = false;
			}
		}
		
		// Ensure decision rationale is provided if decision is made
		if (frm.doc.go_no_go_decision && !frm.doc.decision_rationale) {
			frappe.msgprint(__("Please provide decision rationale"));
			frappe.validated = false;
		}
	},
	
	// Update status based on completion of assessment
	after_save: function(frm) {
		// Check if all required fields for completion are filled
		let completion_fields = [
			'overall_risk_rating', 'overall_reward_rating', 
			'financial_score', 'technical_score', 'strategic_score', 
			'resource_score', 'risk_score'
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
				__('All assessment fields appear to be completed. Update status to "Completed"?'),
				function() {
					frm.set_value('status', 'Completed');
					frm.save();
				}
			);
		}
		
		// Suggest decision if status is Completed but no decision is made
		if (frm.doc.status === "Completed" && !frm.doc.go_no_go_decision && frm.doc.total_score) {
			let suggested_decision = frm.doc.total_score >= 70 ? "Go" : 
				frm.doc.total_score >= 50 ? "Conditional Go" : "No-Go";
			
			frappe.confirm(
				__('Based on the total score of {0}, the suggested decision is "{1}". Would you like to apply this decision?', 
				[frm.doc.total_score, suggested_decision]),
				function() {
					frm.set_value('go_no_go_decision', suggested_decision);
					frm.set_value('decision_date', frappe.datetime.get_today());
					frm.set_value('decision_by', frappe.session.user);
					frm.save();
				}
			);
		}
	},
	
	// Update status when decision is made
	go_no_go_decision: function(frm) {
		if (frm.doc.go_no_go_decision && frm.doc.status === "Completed") {
			let new_status = frm.doc.go_no_go_decision === "Go" || 
				frm.doc.go_no_go_decision === "Conditional Go" ? "Approved" : "Rejected";
			
			frm.set_value('status', new_status);
			frm.set_value('decision_date', frappe.datetime.get_today());
			frm.set_value('decision_by', frappe.session.user);
		}
	}
});

// Helper function to calculate total score
function calculate_total_score(frm) {
	let total = 0;
	let fields = ['financial_score', 'technical_score', 'strategic_score', 'resource_score', 'risk_score'];
	
	for (let field of fields) {
		if (frm.doc[field]) {
			total += frm.doc[field];
		}
	}
	
	frm.set_value('total_score', total);
	
	// Update dashboard with score indicator
	let score_color = total >= 70 ? "green" : (total >= 50 ? "orange" : "red");
	let score_label = total >= 70 ? "High Potential" : (total >= 50 ? "Medium Potential" : "Low Potential");
	
	frm.dashboard.add_indicator(
		__(score_label) + ": " + total + "/100",
		score_color
	);
}

// Helper function to validate score range (0-20)
function validate_score_range(frm, field) {
	if (frm.doc[field] !== undefined && (frm.doc[field] < 0 || frm.doc[field] > 20)) {
		frappe.msgprint(__(field.replace('_', ' ').toUpperCase() + " must be between 0 and 20"));
		frappe.validated = false;
		frm.set_value(field, 0);
	}
}