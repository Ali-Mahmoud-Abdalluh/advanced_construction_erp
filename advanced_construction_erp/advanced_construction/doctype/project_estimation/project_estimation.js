frappe.ui.form.on('Project Estimation', {
	refresh: function(frm) {
		// Add custom buttons
		if (frm.doc.status === "Completed" && frm.doc.approval_status === "Pending") {
			frm.add_custom_button(__('Submit for Approval'), function() {
				frm.set_value('approval_status', 'Pending');
				frappe.msgprint(__('Estimation submitted for approval'));
				frm.save();
			});
		}
		
		if (frm.doc.status === "Completed" && frm.doc.approval_status === "Approved") {
			frm.add_custom_button(__('Create BOQ'), function() {
				frappe.model.open_mapped_doc({
					method: "advanced_construction_erp.pre_construction.doctype.project_estimation.project_estimation.make_bill_of_quantities",
					frm: frm
				});
			}, __('Create'));
			
			frm.add_custom_button(__('Create Project Budget'), function() {
				frappe.model.open_mapped_doc({
					method: "advanced_construction_erp.pre_construction.doctype.project_estimation.project_estimation.make_project_budget",
					frm: frm
				});
			}, __('Create'));
		}
		
		// Set up dashboard indicators
		if (frm.doc.cost_variance_percentage) {
			let variance_color = "green";
			let variance_label = "Under Budget";
			
			if (frm.doc.cost_variance_percentage > 0) {
				variance_color = "red";
				variance_label = "Over Budget";
			} else if (frm.doc.cost_variance_percentage === 0) {
				variance_color = "blue";
				variance_label = "On Budget";
			}
			
			frm.dashboard.add_indicator(
				__(variance_label) + ": " + Math.abs(frm.doc.cost_variance_percentage) + "%",
				variance_color
			);
		}
		
		if (frm.doc.approval_status) {
			let status_color = "blue";
			if (frm.doc.approval_status === "Approved") {
				status_color = "green";
			} else if (frm.doc.approval_status === "Rejected") {
				status_color = "red";
			} else if (frm.doc.approval_status === "Revision Required") {
				status_color = "orange";
			}
			
			frm.dashboard.add_indicator(
				__("Approval") + ": " + __(frm.doc.approval_status),
				status_color
			);
		}
		
		// Add cost summary to dashboard
		if (frm.doc.total_project_cost) {
			let cost_html = "<div class='row'>";
			cost_html += "<div class='col-sm-4'><b>Direct Costs:</b> " + 
				(frm.doc.total_direct_costs ? format_currency(frm.doc.total_direct_costs, frm.doc.currency) : "N/A") + 
				"</div>";
			cost_html += "<div class='col-sm-4'><b>Indirect Costs:</b> " + 
				(frm.doc.total_indirect_costs ? format_currency(frm.doc.total_indirect_costs, frm.doc.currency) : "N/A") + 
				"</div>";
			cost_html += "<div class='col-sm-4'><b>Other Costs:</b> " + 
				(frm.doc.total_other_costs ? format_currency(frm.doc.total_other_costs, frm.doc.currency) : "N/A") + 
				"</div>";
			cost_html += "</div>";
			cost_html += "<div class='row' style='margin-top: 10px;'><div class='col-sm-12'><b>Total Project Cost:</b> " + 
				format_currency(frm.doc.total_project_cost, frm.doc.currency) + 
				"</div></div>";
			
			frm.dashboard.add_section(cost_html, __('Cost Summary'));
		}
	},
	
	// Calculate direct costs
	material_costs: function(frm) { calculate_direct_costs(frm); },
	labor_costs: function(frm) { calculate_direct_costs(frm); },
	equipment_costs: function(frm) { calculate_direct_costs(frm); },
	subcontractor_costs: function(frm) { calculate_direct_costs(frm); },
	
	// Calculate indirect costs
	project_management_costs: function(frm) { calculate_indirect_costs(frm); },
	engineering_design_costs: function(frm) { calculate_indirect_costs(frm); },
	permit_fees: function(frm) { calculate_indirect_costs(frm); },
	insurance_costs: function(frm) { calculate_indirect_costs(frm); },
	temporary_facilities_costs: function(frm) { calculate_indirect_costs(frm); },
	general_conditions: function(frm) { calculate_indirect_costs(frm); },
	
	// Calculate other costs
	contingency_percentage: function(frm) { calculate_contingency_amount(frm); },
	escalation_percentage: function(frm) { calculate_escalation_amount(frm); },
	overhead_percentage: function(frm) { calculate_overhead_amount(frm); },
	profit_percentage: function(frm) { calculate_profit_amount(frm); },
	
	// Calculate risk contingency
	risk_contingency_percentage: function(frm) { calculate_risk_contingency(frm); },
	
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
		
		// Validate percentages
		validate_percentage(frm, 'contingency_percentage');
		validate_percentage(frm, 'escalation_percentage');
		validate_percentage(frm, 'overhead_percentage');
		validate_percentage(frm, 'profit_percentage');
		validate_percentage(frm, 'risk_contingency_percentage');
	},
	
	// Update status based on completion of estimation
	after_save: function(frm) {
		// Check if all required fields for completion are filled
		let completion_fields = [
			'total_direct_costs', 'total_indirect_costs', 'total_project_cost'
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
				__('All major cost sections appear to be completed. Update status to "Completed"?'),
				function() {
					frm.set_value('status', 'Completed');
					frm.save();
				}
			);
		}
	},
	
	// Update document when approval status changes
	approval_status: function(frm) {
		if (frm.doc.approval_status === "Approved" || frm.doc.approval_status === "Rejected") {
			frm.set_value('approved_by', frappe.session.user);
			frm.set_value('approval_date', frappe.datetime.get_today());
			
			if (frm.doc.approval_status === "Approved") {
				frm.set_value('status', 'Approved');
			} else if (frm.doc.approval_status === "Rejected") {
				frm.set_value('status', 'Rejected');
			}
		}
	}
});

// Helper function to calculate direct costs
function calculate_direct_costs(frm) {
	let total = 0;
	let cost_fields = ['material_costs', 'labor_costs', 'equipment_costs', 'subcontractor_costs'];
	
	for (let field of cost_fields) {
		if (frm.doc[field]) {
			total += frm.doc[field];
		}
	}
	
	frm.set_value('total_direct_costs', total);
	calculate_total_base_cost(frm);
}

// Helper function to calculate indirect costs
function calculate_indirect_costs(frm) {
	let total = 0;
	let cost_fields = [
		'project_management_costs', 'engineering_design_costs', 'permit_fees', 
		'insurance_costs', 'temporary_facilities_costs', 'general_conditions'
	];
	
	for (let field of cost_fields) {
		if (frm.doc[field]) {
			total += frm.doc[field];
		}
	}
	
	frm.set_value('total_indirect_costs', total);
	calculate_total_base_cost(frm);
}

// Helper function to calculate total base cost
function calculate_total_base_cost(frm) {
	let direct = frm.doc.total_direct_costs || 0;
	let indirect = frm.doc.total_indirect_costs || 0;
	let total = direct + indirect;
	
	frm.set_value('total_base_cost', total);
	
	// Recalculate amounts that depend on base cost
	calculate_contingency_amount(frm);
	calculate_escalation_amount(frm);
	calculate_overhead_amount(frm);
	calculate_profit_amount(frm);
	calculate_risk_contingency(frm);
	calculate_total_project_cost(frm);
}

// Helper functions to calculate percentage-based amounts
function calculate_contingency_amount(frm) {
	if (frm.doc.contingency_percentage && frm.doc.total_base_cost) {
		let amount = frm.doc.total_base_cost * (frm.doc.contingency_percentage / 100);
		frm.set_value('contingency_amount', amount);
		calculate_total_other_costs(frm);
	}
}

function calculate_escalation_amount(frm) {
	if (frm.doc.escalation_percentage && frm.doc.total_base_cost) {
		let amount = frm.doc.total_base_cost * (frm.doc.escalation_percentage / 100);
		frm.set_value('escalation_amount', amount);
		calculate_total_other_costs(frm);
	}
}

function calculate_overhead_amount(frm) {
	if (frm.doc.overhead_percentage && frm.doc.total_base_cost) {
		let amount = frm.doc.total_base_cost * (frm.doc.overhead_percentage / 100);
		frm.set_value('overhead_amount', amount);
		calculate_total_other_costs(frm);
	}
}

function calculate_profit_amount(frm) {
	if (frm.doc.profit_percentage && frm.doc.total_base_cost) {
		let amount = frm.doc.total_base_cost * (frm.doc.profit_percentage / 100);
		frm.set_value('profit_amount', amount);
		calculate_total_other_costs(frm);
	}
}

function calculate_risk_contingency(frm) {
	if (frm.doc.risk_contingency_percentage && frm.doc.total_base_cost) {
		let amount = frm.doc.total_base_cost * (frm.doc.risk_contingency_percentage / 100);
		frm.set_value('risk_contingency_amount', amount);
		calculate_total_other_costs(frm);
	}
}

// Helper function to calculate total other costs
function calculate_total_other_costs(frm) {
	let total = 0;
	let cost_fields = [
		'contingency_amount', 'escalation_amount', 'overhead_amount', 
		'profit_amount', 'risk_contingency_amount'
	];
	
	for (let field of cost_fields) {
		if (frm.doc[field]) {
			total += frm.doc[field];
		}
	}
	
	frm.set_value('total_other_costs', total);
	calculate_total_project_cost(frm);
}

// Helper function to calculate total project cost
function calculate_total_project_cost(frm) {
	let base = frm.doc.total_base_cost || 0;
	let other = frm.doc.total_other_costs || 0;
	let total = base + other;
	
	frm.set_value('total_project_cost', total);
	
	// Calculate variance from budget
	if (frm.doc.estimated_budget) {
		let variance = total - frm.doc.estimated_budget;
		frm.set_value('cost_variance_from_budget', variance);
		
		let variance_percentage = (variance / frm.doc.estimated_budget) * 100;
		frm.set_value('cost_variance_percentage', variance_percentage);
	}
}

// Helper function to validate percentage fields
function validate_percentage(frm, field) {
	if (frm.doc[field] && (frm.doc[field] < 0 || frm.doc[field] > 100)) {
		frappe.msgprint(__(field.replace('_', ' ').toUpperCase() + " should be between 0 and 100%"));
		frm.set_value(field, 0);
	}
}