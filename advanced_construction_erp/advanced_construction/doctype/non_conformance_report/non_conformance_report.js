// Copyright (c) 2024, Your Company and contributors
// For license information, please see license.txt

frappe.ui.form.on('Non Conformance Report', {
    refresh: function(frm) {
        // Add custom buttons
        if (!frm.doc.__islocal) {
            // Add button to verify actions
            if (frm.doc.docstatus === 1 && frm.doc.status === "Corrective Action Completed") {
                frm.add_custom_button(__('Verify Actions'), function() {
                    verify_actions(frm);
                }, __('Actions'));
            }
            
            // Add button to close NCR
            if (frm.doc.docstatus === 1 && frm.doc.status === "Verified") {
                frm.add_custom_button(__('Close NCR'), function() {
                    close_ncr(frm);
                }, __('Actions'));
            }
            
            // Add button to update action status from tasks
            if (frm.doc.docstatus === 1 && ["Action Plan Created", "Corrective Action Completed"].includes(frm.doc.status)) {
                frm.add_custom_button(__('Update Action Status'), function() {
                    update_action_status(frm);
                }, __('Actions'));
            }
            
            // Add button to view inspection
            if (frm.doc.inspection) {
                frm.add_custom_button(__('View Inspection'), function() {
                    frappe.set_route("Form", "Quality Inspection", frm.doc.inspection);
                }, __('View'));
            }
        }
        
        // Set defaults
        if (frm.doc.__islocal) {
            frm.set_value('date_identified', frappe.datetime.get_today());
            frm.set_value('identified_by', frappe.session.user);
            frm.set_value('status', 'Open');
            frm.set_value('severity', 'Medium');
        }
        
        // Set field permissions
        if (frm.doc.docstatus === 1) {
            frm.set_df_property('issues', 'read_only', 1);
            
            if (frm.doc.status === "Verified" || frm.doc.status === "Closed") {
                frm.set_df_property('corrective_actions', 'read_only', 1);
                frm.set_df_property('preventive_actions', 'read_only', 1);
            }
        }
        
        // Show progress indicators
        if (!frm.doc.__islocal) {
            show_progress_indicators(frm);
        }
    },
    
    setup: function(frm) {
        // Setup filters for reference fields
        frm.set_query("reference_name", function() {
            return {
                filters: {
                    "docstatus": ["!=", 2]  // Not cancelled
                }
            };
        });
        
        // Setup filters for inspection
        frm.set_query("inspection", function() {
            return {
                filters: {
                    "status": "Rejected",
                    "docstatus": 1
                }
            };
        });
        
        // Setup filters for item code
        frm.set_query("item_code", function() {
            return {
                query: "erpnext.controllers.queries.item_query"
            };
        });
    },
    
    inspection: function(frm) {
        // Fetch data from inspection
        if (frm.doc.inspection) {
            frappe.db.get_doc("Quality Inspection", frm.doc.inspection)
                .then(function(inspection) {
                    frm.set_value("project", inspection.project);
                    frm.set_value("reference_type", inspection.reference_type);
                    frm.set_value("reference_name", inspection.reference_name);
                    frm.set_value("item_code", inspection.item_code);
                    frm.set_value("item_name", inspection.item_name);
                    frm.set_value("date_identified", inspection.inspection_date);
                    frm.set_value("identified_by", inspection.inspector);
                    
                    // Add failed items as issues
                    if (inspection.checklist_items) {
                        let failed_items = inspection.checklist_items.filter(item => item.status === "Fail");
                        
                        if (failed_items.length > 0) {
                            // Clear existing issues
                            frm.clear_table("issues");
                            
                            // Add failed items as issues
                            failed_items.forEach(function(item) {
                                let issue = frm.add_child("issues");
                                issue.issue_description = item.check_name;
                                issue.specification = item.specification;
                                issue.expected_value = item.expected_value;
                                issue.actual_value = item.actual_value;
                                issue.is_critical = item.is_critical;
                            });
                            
                            frm.refresh_field("issues");
                        }
                    }
                });
        }
    },
    
    item_code: function(frm) {
        // Fetch item name
        if (frm.doc.item_code) {
            frappe.db.get_value("Item", frm.doc.item_code, ["item_name"], function(r) {
                if (r && r.item_name) {
                    frm.set_value("item_name", r.item_name);
                }
            });
        }
    },
    
    reference_type: function(frm) {
        // Clear reference name when type changes
        frm.set_value("reference_name", "");
    }
});

frappe.ui.form.on('Non Conformance Action', {
    corrective_actions_add: function(frm, cdt, cdn) {
        // Set defaults for new corrective action
        let row = locals[cdt][cdn];
        row.status = "Open";
        row.due_date = frappe.datetime.add_days(frappe.datetime.get_today(), 7);
        row.assigned_to = frappe.session.user;
        frm.refresh_field("corrective_actions");
    },
    
    preventive_actions_add: function(frm, cdt, cdn) {
        // Set defaults for new preventive action
        let row = locals[cdt][cdn];
        row.status = "Open";
        row.due_date = frappe.datetime.add_days(frappe.datetime.get_today(), 14);
        row.assigned_to = frappe.session.user;
        frm.refresh_field("preventive_actions");
    },
    
    status: function(frm, cdt, cdn) {
        // When action status changes to Completed, set completion date
        let row = locals[cdt][cdn];
        if (row.status === "Completed" && !row.completion_date) {
            frappe.model.set_value(cdt, cdn, "completion_date", frappe.datetime.get_today());
        }
    }
});

function verify_actions(frm) {
    // Verify actions
    let d = new frappe.ui.Dialog({
        title: __('Verify Actions'),
        fields: [
            {
                label: __('Verification Method'),
                fieldname: 'verification_method',
                fieldtype: 'Select',
                options: 'Inspection\nTesting\nDocument Review\nAudit\nOther',
                reqd: 1
            },
            {
                label: __('Verification Result'),
                fieldname: 'verification_result',
                fieldtype: 'Select',
                options: 'Passed\nFailed',
                reqd: 1
            },
            {
                label: __('Verification Remarks'),
                fieldname: 'verification_remarks',
                fieldtype: 'Text'
            }
        ],
        primary_action_label: __('Verify'),
        primary_action: function() {
            let values = d.get_values();
            
            frm.set_value('verification_method', values.verification_method);
            frm.set_value('verification_result', values.verification_result);
            frm.set_value('verification_remarks', values.verification_remarks);
            frm.set_value('verification_date', frappe.datetime.get_today());
            frm.set_value('verified_by', frappe.session.user);
            
            if (values.verification_result === 'Passed') {
                frm.set_value('status', 'Verified');
            }
            
            frm.save();
            d.hide();
            
            frappe.show_alert({
                message: __("Actions verified"),
                indicator: values.verification_result === 'Passed' ? 'green' : 'red'
            });
        }
    });
    d.show();
}

function close_ncr(frm) {
    // Close NCR
    frappe.confirm(
        __('Are you sure you want to close this Non-Conformance Report?'),
        function() {
            frm.set_value('status', 'Closed');
            frm.save();
            
            frappe.show_alert({
                message: __("Non-Conformance Report closed"),
                indicator: 'green'
            });
        }
    );
}

function update_action_status(frm) {
    // Update action status from tasks
    frappe.call({
        method: "update_action_status",
        doc: frm.doc,
        callback: function(r) {
            frm.refresh();
            frappe.show_alert({
                message: __("Action status updated"),
                indicator: 'green'
            });
        }
    });
}

function show_progress_indicators(frm) {
    // Show progress indicators for actions
    let corrective_actions_total = frm.doc.corrective_actions ? frm.doc.corrective_actions.length : 0;
    let corrective_actions_completed = frm.doc.corrective_actions ? frm.doc.corrective_actions.filter(a => a.status === "Completed").length : 0;
    
    let preventive_actions_total = frm.doc.preventive_actions ? frm.doc.preventive_actions.length : 0;
    let preventive_actions_completed = frm.doc.preventive_actions ? frm.doc.preventive_actions.filter(a => a.status === "Completed").length : 0;
    
    if (corrective_actions_total > 0) {
        let corrective_progress = (corrective_actions_completed / corrective_actions_total) * 100;
        frm.dashboard.add_progress("Corrective Actions", corrective_progress);
    }
    
    if (preventive_actions_total > 0) {
        let preventive_progress = (preventive_actions_completed / preventive_actions_total) * 100;
        frm.dashboard.add_progress("Preventive Actions", preventive_progress);
    }
    
    // Add indicators for critical issues
    let critical_issues = frm.doc.issues ? frm.doc.issues.filter(i => i.is_critical).length : 0;
    if (critical_issues > 0) {
        frm.dashboard.add_indicator(__("Critical Issues: {0}", [critical_issues]), "red");
    }
} 