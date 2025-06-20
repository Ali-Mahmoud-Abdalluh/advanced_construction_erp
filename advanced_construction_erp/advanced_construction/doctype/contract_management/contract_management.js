frappe.ui.form.on('Contract Management', {
    refresh: function(frm) {
        // Add custom buttons
        if (!frm.doc.__islocal && frm.doc.docstatus === 1) {
            // Add button to create invoice
            frm.add_custom_button(__('Create Invoice'), function() {
                show_milestone_dialog(frm);
            }, __('Actions'));
            
            // Add button to view payment schedule
            frm.add_custom_button(__('Payment Schedule'), function() {
                show_payment_schedule(frm);
            }, __('View'));
            
            // Add button to view contract summary
            frm.add_custom_button(__('Contract Summary'), function() {
                show_contract_summary(frm);
            }, __('View'));
            
            // Add button to create amendment
            frm.add_custom_button(__('Create Amendment'), function() {
                create_amendment(frm);
            }, __('Actions'));
        }
        
        // Show contract summary in dashboard
        if (!frm.doc.__islocal && frm.doc.docstatus === 1) {
            frappe.call({
                method: "get_contract_summary",
                doc: frm.doc,
                callback: function(r) {
                    if (r.message) {
                        let summary = r.message;
                        
                        // Add milestone progress
                        frm.dashboard.add_progress("Milestones", summary.milestone_progress);
                        
                        // Add payment progress
                        frm.dashboard.add_progress("Payments", summary.payment_percentage);
                        
                        // Add indicators
                        frm.dashboard.add_indicator(__("Days Remaining: {0}", [summary.days_remaining]), 
                            summary.days_remaining < 30 ? "red" : "green");
                            
                        frm.dashboard.add_indicator(__("Paid Amount: {0}", [format_currency(summary.paid_amount, frm.doc.currency)]), 
                            summary.payment_percentage < 50 ? "orange" : "green");
                    }
                }
            });
        }
    },
    
    validate: function(frm) {
        // Calculate contract duration
        if (frm.doc.start_date && frm.doc.end_date) {
            let start = frappe.datetime.str_to_obj(frm.doc.start_date);
            let end = frappe.datetime.str_to_obj(frm.doc.end_date);
            
            let diff_days = frappe.datetime.get_diff(frm.doc.end_date, frm.doc.start_date);
            frm.doc.contract_duration = diff_days;
        }
    },
    
    start_date: function(frm) {
        // Validate dates
        if (frm.doc.start_date && frm.doc.end_date && 
            frappe.datetime.str_to_obj(frm.doc.start_date) > frappe.datetime.str_to_obj(frm.doc.end_date)) {
            frappe.msgprint(__("Start Date cannot be after End Date"));
            frm.doc.start_date = "";
            frm.refresh_field("start_date");
        }
    },
    
    end_date: function(frm) {
        // Validate dates
        if (frm.doc.start_date && frm.doc.end_date && 
            frappe.datetime.str_to_obj(frm.doc.end_date) < frappe.datetime.str_to_obj(frm.doc.start_date)) {
            frappe.msgprint(__("End Date cannot be before Start Date"));
            frm.doc.end_date = "";
            frm.refresh_field("end_date");
        }
    },
    
    contract_value: function(frm) {
        // Update milestone payment amounts based on percentages
        if (frm.doc.milestones && frm.doc.milestones.length > 0) {
            $.each(frm.doc.milestones, function(i, milestone) {
                if (milestone.payment_percentage) {
                    milestone.payment_amount = flt(frm.doc.contract_value) * flt(milestone.payment_percentage) / 100;
                }
            });
            frm.refresh_field("milestones");
        }
    }
});

frappe.ui.form.on('Contract Milestone', {
    payment_percentage: function(frm, cdt, cdn) {
        let milestone = locals[cdt][cdn];
        if (milestone.payment_percentage && frm.doc.contract_value) {
            milestone.payment_amount = flt(frm.doc.contract_value) * flt(milestone.payment_percentage) / 100;
            frm.refresh_field("milestones");
        }
    },
    
    payment_amount: function(frm, cdt, cdn) {
        let milestone = locals[cdt][cdn];
        if (milestone.payment_amount && frm.doc.contract_value) {
            milestone.payment_percentage = flt(milestone.payment_amount) / flt(frm.doc.contract_value) * 100;
            frm.refresh_field("milestones");
        }
    }
});

function show_milestone_dialog(frm) {
    // Show dialog to select milestone for invoice creation
    if (!frm.doc.milestones || frm.doc.milestones.length === 0) {
        frappe.msgprint(__("No milestones found in this contract"));
        return;
    }
    
    let milestones = [];
    $.each(frm.doc.milestones, function(i, milestone) {
        if (milestone.payment_status !== "Paid" && milestone.payment_status !== "Invoiced") {
            milestones.push({
                label: milestone.milestone_name + " - " + format_currency(milestone.payment_amount, frm.doc.currency),
                value: milestone.name
            });
        }
    });
    
    if (milestones.length === 0) {
        frappe.msgprint(__("All milestones have been invoiced or paid"));
        return;
    }
    
    let d = new frappe.ui.Dialog({
        title: __('Create Invoice for Milestone'),
        fields: [
            {
                label: __('Milestone'),
                fieldname: 'milestone',
                fieldtype: 'Select',
                options: milestones,
                reqd: 1
            }
        ],
        primary_action_label: __('Create Invoice'),
        primary_action: function() {
            let values = d.get_values();
            
            if (!values.milestone) {
                frappe.msgprint(__("Please select a milestone"));
                return;
            }
            
            frappe.call({
                method: "create_invoice",
                doc: frm.doc,
                args: {
                    milestone: frm.doc.milestones.find(m => m.name === values.milestone)
                },
                callback: function(r) {
                    if (r.message) {
                        frappe.msgprint(__("Invoice {0} created", [r.message]));
                        frm.reload_doc();
                    }
                }
            });
            
            d.hide();
        }
    });
    
    d.show();
}

function show_payment_schedule(frm) {
    // Show payment schedule based on milestones
    frappe.call({
        method: "get_payment_schedule",
        doc: frm.doc,
        callback: function(r) {
            if (r.message && r.message.length) {
                let payment_schedule = r.message;
                
                let d = new frappe.ui.Dialog({
                    title: __('Payment Schedule'),
                    fields: [
                        {
                            fieldname: 'schedule_html',
                            fieldtype: 'HTML'
                        }
                    ]
                });
                
                let html = '<div class="payment-schedule">';
                html += '<table class="table table-bordered">';
                html += `
                    <thead>
                        <tr>
                            <th>${__('Milestone')}</th>
                            <th>${__('Due Date')}</th>
                            <th>${__('Amount')}</th>
                            <th>${__('Percentage')}</th>
                            <th>${__('Status')}</th>
                        </tr>
                    </thead>
                    <tbody>
                `;
                
                payment_schedule.forEach(item => {
                    let status_color = item.status === 'Paid' ? 'green' : 
                                    item.status === 'Invoiced' ? 'blue' : 'orange';
                    
                    html += `
                        <tr>
                            <td>${item.milestone}</td>
                            <td>${frappe.datetime.str_to_user(item.due_date)}</td>
                            <td>${format_currency(item.amount, frm.doc.currency)}</td>
                            <td>${item.percentage.toFixed(2)}%</td>
                            <td><span class="indicator ${status_color}">${item.status}</span></td>
                        </tr>
                    `;
                });
                
                html += '</tbody></table>';
                html += '</div>';
                
                d.fields_dict.schedule_html.$wrapper.html(html);
                d.show();
            } else {
                frappe.msgprint(__("No payment schedule found"));
            }
        }
    });
}

function show_contract_summary(frm) {
    // Show contract summary
    frappe.call({
        method: "get_contract_summary",
        doc: frm.doc,
        callback: function(r) {
            if (r.message) {
                let summary = r.message;
                
                let d = new frappe.ui.Dialog({
                    title: __('Contract Summary'),
                    fields: [
                        {
                            fieldname: 'summary_html',
                            fieldtype: 'HTML'
                        }
                    ]
                });
                
                let html = '<div class="contract-summary">';
                
                // Contract details
                html += `
                    <div class="row">
                        <div class="col-sm-6">
                            <div class="summary-card">
                                <h5>${__('Contract Number')}</h5>
                                <div class="value">${frm.doc.contract_number}</div>
                            </div>
                        </div>
                        <div class="col-sm-6">
                            <div class="summary-card">
                                <h5>${__('Contract Value')}</h5>
                                <div class="value">${format_currency(frm.doc.contract_value, frm.doc.currency)}</div>
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-sm-6">
                            <div class="summary-card">
                                <h5>${__('Contract Period')}</h5>
                                <div class="value">
                                    ${frappe.datetime.str_to_user(frm.doc.start_date)} - 
                                    ${frappe.datetime.str_to_user(frm.doc.end_date)}
                                </div>
                            </div>
                        </div>
                        <div class="col-sm-6">
                            <div class="summary-card">
                                <h5>${__('Days Remaining')}</h5>
                                <div class="value">${summary.days_remaining}</div>
                            </div>
                        </div>
                    </div>
                `;
                
                // Milestone progress
                html += `
                    <div class="row">
                        <div class="col-sm-12">
                            <div class="summary-card">
                                <h5>${__('Milestone Progress')}</h5>
                                <div class="value">${summary.completed_milestones} / ${summary.total_milestones}</div>
                                <div class="progress" style="margin-top: 10px;">
                                    <div class="progress-bar" role="progressbar" 
                                        style="width: ${summary.milestone_progress}%;" 
                                        aria-valuenow="${summary.milestone_progress}" 
                                        aria-valuemin="0" aria-valuemax="100">
                                        ${summary.milestone_progress.toFixed(2)}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                // Payment progress
                html += `
                    <div class="row">
                        <div class="col-sm-12">
                            <div class="summary-card">
                                <h5>${__('Payment Progress')}</h5>
                                <div class="value">
                                    ${format_currency(summary.paid_amount, frm.doc.currency)} / 
                                    ${format_currency(frm.doc.contract_value, frm.doc.currency)}
                                </div>
                                <div class="progress" style="margin-top: 10px;">
                                    <div class="progress-bar" role="progressbar" 
                                        style="width: ${summary.payment_percentage}%;" 
                                        aria-valuenow="${summary.payment_percentage}" 
                                        aria-valuemin="0" aria-valuemax="100">
                                        ${summary.payment_percentage.toFixed(2)}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                html += '</div>';
                html += `
                    <style>
                        .summary-card {
                            border: 1px solid #d1d8dd;
                            border-radius: 4px;
                            padding: 15px;
                            margin-bottom: 15px;
                            text-align: center;
                        }
                        .summary-card h5 {
                            margin-top: 0;
                            margin-bottom: 10px;
                        }
                        .summary-card .value {
                            font-size: 18px;
                            font-weight: bold;
                        }
                    </style>
                `;
                
                d.fields_dict.summary_html.$wrapper.html(html);
                d.show();
            }
        }
    });
}

function create_amendment(frm) {
    // Create contract amendment
    frappe.model.open_mapped_doc({
        method: "advanced_construction_erp.construction_project.doctype.contract_management.contract_management.make_contract_amendment",
        frm: frm
    });
} 