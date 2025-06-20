frappe.ui.form.on('Bill of Quantities', {
	refresh: function(frm) {
		// Add custom buttons
		if (frm.doc.status === "Completed") {
			frm.add_custom_button(__('Submit for Approval'), function() {
				frm.set_value('status', 'Approved');
				frappe.msgprint(__('Bill of Quantities submitted for approval'));
				frm.save();
			});
		}
		
		if (frm.doc.status === "Approved") {
			frm.add_custom_button(__('Create Purchase Order'), function() {
				frappe.model.open_mapped_doc({
					method: "advanced_construction_erp.pre_construction.doctype.bill_of_quantities.bill_of_quantities.make_purchase_order",
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
		
		// Add BOQ summary to dashboard
		if (frm.doc.total_amount) {
			let summary_html = "<div class='row'>";
			summary_html += "<div class='col-sm-6'><b>Total BOQ Amount:</b> " + 
				format_currency(frm.doc.total_amount, frm.doc.currency) + 
				"</div>";
			summary_html += "<div class='col-sm-6'><b>Estimated Cost:</b> " + 
				format_currency(frm.doc.estimated_cost, frm.doc.currency) + 
				"</div>";
			summary_html += "</div>";
			
			if (frm.doc.variance_from_estimation) {
				let variance_class = frm.doc.variance_from_estimation > 0 ? "text-danger" : "text-success";
				summary_html += "<div class='row' style='margin-top: 10px;'>";
				summary_html += "<div class='col-sm-12 " + variance_class + "'><b>Variance:</b> " + 
					format_currency(frm.doc.variance_from_estimation, frm.doc.currency) + 
					" (" + frm.doc.variance_percentage + "%)</div>";
				summary_html += "</div>";
			}
			
			frm.dashboard.add_section(summary_html, __('BOQ Summary'));
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
						frm.set_value('estimated_cost', estimation.total_project_cost);
						frm.set_value('currency', estimation.currency);
						frm.set_value('expected_start_date', estimation.expected_start_date);
						frm.set_value('expected_completion_date', estimation.expected_completion_date);
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
		
		// Calculate total amount
		calculate_total_amount(frm);
	},
	
	after_save: function(frm) {
		// Check if all required fields for completion are filled
		let completion_fields = ['total_amount'];
		
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
	}
});

// Helper function to calculate total amount
function calculate_total_amount(frm) {
	let total = 0;
	
	// Calculate total from BOQ items
	if (frm.doc.boq_items && frm.doc.boq_items.length) {
		frm.doc.boq_items.forEach(function(item) {
			// Calculate amount for each item
			if (item.quantity && item.rate) {
				item.amount = item.quantity * item.rate;
			}
			
			// Add to total
			if (item.amount) {
				total += item.amount;
			}
		});
	}
	
	// Set total amount
	frm.set_value('total_amount', total);
	
	// Calculate variance from estimation
	if (frm.doc.estimated_cost) {
		let variance = total - frm.doc.estimated_cost;
		frm.set_value('variance_from_estimation', variance);
		
		let variance_percentage = (variance / frm.doc.estimated_cost) * 100;
		frm.set_value('variance_percentage', variance_percentage);
	}
}

// Helper function to calculate amount for each BOQ item
frappe.ui.form.on('Bill of Quantities Item', {
	quantity: function(frm, cdt, cdn) {
		let item = locals[cdt][cdn];
		if (item.quantity && item.rate) {
			frappe.model.set_value(cdt, cdn, 'amount', item.quantity * item.rate);
			calculate_total_amount(frm);
		}
	},
	
	rate: function(frm, cdt, cdn) {
		let item = locals[cdt][cdn];
		if (item.quantity && item.rate) {
			frappe.model.set_value(cdt, cdn, 'amount', item.quantity * item.rate);
			calculate_total_amount(frm);
		}
	},
	
	boq_items_add: function(frm, cdt, cdn) {
		calculate_total_amount(frm);
	},
	
	boq_items_remove: function(frm, cdt, cdn) {
		calculate_total_amount(frm);
	}
});