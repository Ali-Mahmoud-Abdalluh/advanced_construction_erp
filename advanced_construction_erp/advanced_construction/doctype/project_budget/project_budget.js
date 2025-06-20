frappe.ui.form.on('Project Budget', {
	refresh: function(frm) {
		// Add custom buttons
		if (frm.doc.status === "Completed" && frm.doc.approval_status === "Pending") {
			frm.add_custom_button(__('Submit for Approval'), function() {
				frm.set_value('approval_status', 'Pending');
				frappe.msgprint(__('Budget submitted for approval'));
				frm.save();
			});
		}
		
		if (frm.doc.status === "Approved") {
			frm.add_custom_button(__('Create Budget Monitoring'), function() {
				frappe.model.open_mapped_doc({
					method: "advanced_construction_erp.pre_construction.doctype.project_budget.project_budget.make_budget_monitoring",
					frm: frm
				});
			}, __('Create'));
		}
		
		// Set up dashboard indicators
		if (frm.doc.variance_percentage) {
			let variance_color = "green";
			let variance_label = "Under Budget";
			
			if (frm.doc.variance_percentage > 0) {
				variance_color = "red";
				variance_label = "Over Budget";
			} else if (frm.doc.variance_percentage === 0) {
				variance_color = "blue";
				variance_label = "On Budget";
			}
			
			frm.dashboard.add_indicator(
				__(variance_label) + ": " + Math.abs(frm.doc.variance_percentage) + "%",
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
		
		// Add budget summary to dashboard
		if (frm.doc.total_budgeted_amount) {
			let budget_html = "<div class='row'>";
			budget_html += "<div class='col-sm-4'><b>Total Budget:</b> " + 
				format_currency(frm.doc.total_budget, frm.doc.currency) + 
				"</div>";
			budget_html += "<div class='col-sm-4'><b>Total Budgeted:</b> " + 
				format_currency(frm.doc.total_budgeted_amount, frm.doc.currency) + 
				"</div>";
			budget_html += "<div class='col-sm-4'><b>Total Actual:</b> " + 
				(frm.doc.total_actual_spent ? format_currency(frm.doc.total_actual_spent, frm.doc.currency) : "N/A") + 
				"</div>";
			budget_html += "</div>";
			
			if (frm.doc.total_variance) {
				let variance_class = frm.doc.total_variance > 0 ? "text-danger" : "text-success";
				budget_html += "<div class='row' style='margin-top: 10px;'>";
				budget_html += "<div class='col-sm-12 " + variance_class + "'><b>Variance:</b> " + 
					format_currency(frm.doc.total_variance, frm.doc.currency) + 
					" (" + frm.doc.variance_percentage + "%)</div>";
				budget_html += "</div>";
			}
			
			frm.dashboard.add_section(budget_html, __('Budget Summary'));
		}
	},
	
	project_estimation: function(frm) {
		// Fetch details from Project Estimation
		if (frm.doc.project_estimation) {
			frappe.call({
				method: "frappe.client.get",
				args: {
					doctype: "Project Estimation",
					name: frm.doc.project_estimation
				},
				callback: function(r) {
					if (r.message) {
						let estimation = r.message;
						frm.set_value('project_name', estimation.project_name);
						frm.set_value('total_budget', estimation.total_project_cost);
						frm.set_value('currency', estimation.currency);
						frm.set_value('expected_start_date', estimation.expected_start_date);
						frm.set_value('expected_completion_date', estimation.expected_completion_date);
						
						// Clear existing budget categories
						frm.clear_table('budget_categories');
						
						// Add budget categories from estimation
						if (estimation.material_costs) {
							frm.add_child('budget_categories', {
								category: 'Materials',
								amount: estimation.material_costs
							});
						}
						
						if (estimation.labor_costs) {
							frm.add_child('budget_categories', {
								category: 'Labor',
								amount: estimation.labor_costs
							});
						}
						
						if (estimation.equipment_costs) {
							frm.add_child('budget_categories', {
								category: 'Equipment',
								amount: estimation.equipment_costs
							});
						}
						
						if (estimation.subcontractor_costs) {
							frm.add_child('budget_categories', {
								category: 'Subcontractors',
								amount: estimation.subcontractor_costs
							});
						}
						
						if (estimation.project_management_costs) {
							frm.add_child('budget_categories', {
								category: 'Project Management',
								amount: estimation.project_management_costs
							});
						}
						
						if (estimation.engineering_design_costs) {
							frm.add_child('budget_categories', {
								category: 'Engineering & Design',
								amount: estimation.engineering_design_costs
							});
						}
						
						if (estimation.permit_fees) {
							frm.add_child('budget_categories', {
								category: 'Permits & Fees',
								amount: estimation.permit_fees
							});
						}
						
						if (estimation.insurance_costs) {
							frm.add_child('budget_categories', {
								category: 'Insurance',
								amount: estimation.insurance_costs
							});
						}
						
						if (estimation.temporary_facilities_costs) {
							frm.add_child('budget_categories', {
								category: 'Temporary Facilities',
								amount: estimation.temporary_facilities_costs
							});
						}
						
						if (estimation.general_conditions) {
							frm.add_child('budget_categories', {
								category: 'General Conditions',
								amount: estimation.general_conditions
							});
						}
						
						if (estimation.contingency_amount) {
							frm.add_child('budget_categories', {
								category: 'Contingency',
								amount: estimation.contingency_amount
							});
						}
						
						if (estimation.escalation_amount) {
							frm.add_child('budget_categories', {
								category: 'Escalation',
								amount: estimation.escalation_amount
							});
						}
						
						if (estimation.overhead_amount) {
							frm.add_child('budget_categories', {
								category: 'Overhead',
								amount: estimation.overhead_amount
							});
						}
						
						if (estimation.profit_amount) {
							frm.add_child('budget_categories', {
								category: 'Profit',
								amount: estimation.profit_amount
							});
						}
						
						if (estimation.risk_contingency_amount) {
							frm.add_child('budget_categories', {
								category: 'Risk Contingency',
								amount: estimation.risk_contingency_amount
							});
						}
						
						frm.refresh_field('budget_categories');
						calculate_budget_totals(frm);
					}
				}
			});
		}
	},
	
	validate: function(frm) {
		// Validate expected start and completion dates
		if (frm.doc.expected_start_date && frm.doc.expected_completion_date) {
			if (frappe.datetime.str_to_obj(frm.doc.expected_completion_date) < 
				frappe.datetime.str_to_obj(frm.doc.expected_start_date)) {
				frappe.msgprint(__("Expected completion date cannot be before expected start date"));
				frappe.validated = false;
			}
		}
		
		// Calculate budget totals
		calculate_budget_totals(frm);
	},
	
	after_save: function(frm) {
		// Check if all required fields for completion are filled
		let completion_fields = ['total_budgeted_amount'];
		
		let all_completed = true;
		for (let field of completion_fields) {
			if (!frm.doc[field]) {
				all_completed = false;
				break;
			}
		}
		
		// Suggest status update if all fields are completed but status is still Draft or In Progress
		if (all_completed && (frm.doc.status === "Draft" || frm.doc.status === "In Progress")) {
			frappe.confirm(
				__('All required fields appear to be completed. Update status to "Completed"?'),
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

// Helper function to calculate budget totals
function calculate_budget_totals(frm) {
	let total_budgeted = 0;
	let total_actual = 0;
	let total_variance = 0;
	
	// Calculate totals from budget categories
	if (frm.doc.budget_categories && frm.doc.budget_categories.length) {
		frm.doc.budget_categories.forEach(function(category) {
			// Calculate percentage of total
			if (category.amount && frm.doc.total_budget) {
				category.percentage_of_total = (category.amount / frm.doc.total_budget) * 100;
			}
			
			// Calculate variance
			if (category.amount && category.actual_spent) {
				category.variance = category.actual_spent - category.amount;
			}
			
			// Add to totals
			if (category.amount) {
				total_budgeted += category.amount;
			}
			
			if (category.actual_spent) {
				total_actual += category.actual_spent;
			}
			
			if (category.variance) {
				total_variance += category.variance;
			}
		});
	}
	
	// Set total values
	frm.set_value('total_budgeted_amount', total_budgeted);
	frm.set_value('total_actual_spent', total_actual);
	frm.set_value('total_variance', total_variance);
	
	// Calculate variance percentage
	if (total_budgeted) {
		let variance_percentage = (total_variance / total_budgeted) * 100;
		frm.set_value('variance_percentage', variance_percentage);
	}
}

// Helper function to calculate budget category values
frappe.ui.form.on('Project Budget Category', {
	amount: function(frm, cdt, cdn) {
		calculate_budget_totals(frm);
	},
	
	actual_spent: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		
		// Calculate variance
		if (row.amount && row.actual_spent) {
			frappe.model.set_value(cdt, cdn, 'variance', row.actual_spent - row.amount);
		}
		
		calculate_budget_totals(frm);
	},
	
	budget_categories_add: function(frm, cdt, cdn) {
		calculate_budget_totals(frm);
	},
	
	budget_categories_remove: function(frm, cdt, cdn) {
		calculate_budget_totals(frm);
	}
});