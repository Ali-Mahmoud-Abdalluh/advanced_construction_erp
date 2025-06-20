// Copyright (c) 2024, Your Company and contributors
// For license information, please see license.txt

frappe.ui.form.on('Quality Inspection', {
    refresh: function(frm) {
        // Add custom buttons
        if (!frm.doc.__islocal) {
            // Add button to copy from checklist
            if (frm.doc.docstatus === 0) {
                frm.add_custom_button(__('Copy from Checklist'), function() {
                    select_checklist(frm);
                }, __('Actions'));
                
                // Add button to mark all as passed
                frm.add_custom_button(__('Mark All as Passed'), function() {
                    update_all_items(frm, "Pass");
                }, __('Actions'));
                
                // Add button to mark all as failed
                frm.add_custom_button(__('Mark All as Failed'), function() {
                    update_all_items(frm, "Fail");
                }, __('Actions'));
            }
            
            // Add button to view summary
            frm.add_custom_button(__('View Summary'), function() {
                show_summary(frm);
            }, __('View'));
            
            // Add button to create non-conformance report
            if (frm.doc.docstatus === 1 && frm.doc.status === "Rejected") {
                frm.add_custom_button(__('Create Non-Conformance Report'), function() {
                    frappe.model.open_mapped_doc({
                        method: "advanced_construction_erp.quality_management.doctype.quality_inspection.quality_inspection.make_nonconformance_report",
                        frm: frm
                    });
                }, __('Create'));
            }
        }
        
        // Show inspection summary in dashboard
        if (!frm.doc.__islocal && frm.doc.checklist_items && frm.doc.checklist_items.length > 0) {
            frm.dashboard.add_progress("Quality Score", frm.doc.quality_score);
            
            let stats = {
                "Passed": frm.doc.passed_checks,
                "Failed": frm.doc.failed_checks
            };
            
            frm.dashboard.add_stats(stats);
            
            // Add indicator for critical failures
            let critical_failures = frm.doc.checklist_items.filter(item => item.status === "Fail" && item.is_critical).length;
            if (critical_failures > 0) {
                frm.dashboard.add_indicator(__("Critical Failures: {0}", [critical_failures]), "red");
            }
        }
        
        // Set field permissions
        if (frm.doc.docstatus === 1) {
            frm.set_df_property("checklist_items", "read_only", 1);
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
        
        // Setup filters for quality checklist
        frm.set_query("quality_checklist", function() {
            return {
                filters: {
                    "status": "Active"
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
    
    validate: function(frm) {
        // Calculate results
        calculate_results(frm);
    },
    
    quality_checklist: function(frm) {
        // Load checklist items when checklist is selected
        if (frm.doc.quality_checklist) {
            frappe.call({
                method: "copy_from_checklist",
                doc: frm.doc,
                args: {
                    checklist: frm.doc.quality_checklist
                },
                callback: function(r) {
                    if (r.message) {
                        frm.refresh_field("checklist_items");
                        calculate_results(frm);
                    }
                }
            });
        }
    },
    
    item_code: function(frm) {
        // Fetch item details when item code is selected
        if (frm.doc.item_code) {
            frappe.db.get_value("Item", frm.doc.item_code, ["item_name", "item_group"], function(r) {
                if (r) {
                    frm.set_value("item_name", r.item_name);
                    frm.set_value("item_group", r.item_group);
                }
            });
            
            // Try to find a matching checklist for this item
            frappe.db.get_list("Quality Checklist", {
                filters: {
                    "applicable_to": "Specific Item Group",
                    "status": "Active"
                },
                fields: ["name"]
            }).then(function(checklists) {
                if (checklists && checklists.length > 0) {
                    frm.set_value("quality_checklist", checklists[0].name);
                }
            });
        }
    },
    
    reference_type: function(frm) {
        // Clear reference name when type changes
        frm.set_value("reference_name", "");
        
        // Set dynamic filters for reference name
        if (frm.doc.reference_type) {
            frm.set_query("reference_name", function() {
                return {
                    filters: {
                        "docstatus": ["!=", 2]  // Not cancelled
                    }
                };
            });
        }
    },
    
    reference_name: function(frm) {
        // Fetch item details from reference document
        if (frm.doc.reference_type && frm.doc.reference_name) {
            if (["Purchase Receipt", "Delivery Note", "Stock Entry"].includes(frm.doc.reference_type)) {
                // Show item selection dialog for documents with multiple items
                frappe.db.get_doc(frm.doc.reference_type, frm.doc.reference_name)
                    .then(function(doc) {
                        if (doc.items && doc.items.length > 0) {
                            let items = [];
                            doc.items.forEach(function(item) {
                                items.push({
                                    "label": item.item_code + " - " + item.item_name,
                                    "value": item.item_code
                                });
                            });
                            
                            if (items.length === 1) {
                                // If only one item, select it automatically
                                frm.set_value("item_code", items[0].value);
                            } else {
                                // Show dialog to select item
                                let d = new frappe.ui.Dialog({
                                    title: __('Select Item for Inspection'),
                                    fields: [
                                        {
                                            label: __('Item'),
                                            fieldname: 'item',
                                            fieldtype: 'Select',
                                            options: items,
                                            reqd: 1
                                        }
                                    ],
                                    primary_action_label: __('Select'),
                                    primary_action: function() {
                                        let values = d.get_values();
                                        frm.set_value("item_code", values.item);
                                        d.hide();
                                    }
                                });
                                d.show();
                            }
                        }
                    });
            } else if (frm.doc.reference_type === "Task") {
                // For tasks, set project from task
                frappe.db.get_value("Task", frm.doc.reference_name, ["project"], function(r) {
                    if (r && r.project) {
                        frm.set_value("project", r.project);
                    }
                });
            }
        }
    },
    
    inspector: function(frm) {
        // Fetch inspector name
        if (frm.doc.inspector) {
            frappe.db.get_value("User", frm.doc.inspector, ["full_name"], function(r) {
                if (r && r.full_name) {
                    frm.set_value("inspector_name", r.full_name);
                }
            });
        }
    },
    
    supervisor: function(frm) {
        // Fetch supervisor name
        if (frm.doc.supervisor) {
            frappe.db.get_value("User", frm.doc.supervisor, ["full_name"], function(r) {
                if (r && r.full_name) {
                    frm.set_value("supervisor_name", r.full_name);
                }
            });
        }
    }
});

frappe.ui.form.on('Quality Inspection Item', {
    status: function(frm, cdt, cdn) {
        // Recalculate results when any item status changes
        calculate_results(frm);
    }
});

function calculate_results(frm) {
    // Calculate inspection results
    if (!frm.doc.checklist_items || frm.doc.checklist_items.length === 0) {
        return;
    }
    
    let total = frm.doc.checklist_items.length;
    let passed = 0;
    let failed = 0;
    let na = 0;
    
    frm.doc.checklist_items.forEach(function(item) {
        if (item.status === "Pass") {
            passed++;
        } else if (item.status === "Fail") {
            failed++;
        } else if (item.status === "Not Applicable") {
            na++;
        }
    });
    
    frm.set_value("total_checks", total);
    frm.set_value("passed_checks", passed);
    frm.set_value("failed_checks", failed);
    
    // Calculate quality score (excluding N/A items)
    let applicable_items = total - na;
    if (applicable_items > 0) {
        frm.set_value("quality_score", (passed / applicable_items) * 100);
    } else {
        frm.set_value("quality_score", 0);
    }
}

function update_all_items(frm, status) {
    // Update all checklist items with the given status
    if (!frm.doc.checklist_items || frm.doc.checklist_items.length === 0) {
        frappe.msgprint(__("No checklist items to update"));
        return;
    }
    
    $.each(frm.doc.checklist_items, function(i, item) {
        frappe.model.set_value(item.doctype, item.name, "status", status);
    });
    
    calculate_results(frm);
    frm.refresh_field("checklist_items");
    
    frappe.show_alert({
        message: __("All items marked as {0}", [status]),
        indicator: status === "Pass" ? "green" : "red"
    });
}

function select_checklist(frm) {
    // Dialog to select a quality checklist
    frappe.db.get_list("Quality Checklist", {
        filters: {
            "status": "Active"
        },
        fields: ["name", "checklist_type", "description"]
    }).then(function(checklists) {
        if (!checklists || checklists.length === 0) {
            frappe.msgprint(__("No active checklists found"));
            return;
        }
        
        let options = [];
        checklists.forEach(function(checklist) {
            options.push({
                "label": checklist.name + " - " + checklist.checklist_type,
                "value": checklist.name,
                "description": checklist.description
            });
        });
        
        let d = new frappe.ui.Dialog({
            title: __('Select Quality Checklist'),
            fields: [
                {
                    label: __('Checklist'),
                    fieldname: 'checklist',
                    fieldtype: 'Select',
                    options: options,
                    reqd: 1
                }
            ],
            primary_action_label: __('Select'),
            primary_action: function() {
                let values = d.get_values();
                frm.set_value("quality_checklist", values.checklist);
                d.hide();
            }
        });
        d.show();
    });
}

function show_summary(frm) {
    // Show inspection summary
    if (!frm.doc.checklist_items || frm.doc.checklist_items.length === 0) {
        frappe.msgprint(__("No checklist items to summarize"));
        return;
    }
    
    let d = new frappe.ui.Dialog({
        title: __('Inspection Summary'),
        fields: [
            {
                fieldname: 'summary_html',
                fieldtype: 'HTML'
            }
        ]
    });
    
    let html = '<div class="inspection-summary">';
    
    // Summary stats
    html += '<div class="row">';
    html += '<div class="col-sm-4 text-center"><div class="stat-box"><h3>' + frm.doc.total_checks + '</h3><p>Total Checks</p></div></div>';
    html += '<div class="col-sm-4 text-center"><div class="stat-box passed"><h3>' + frm.doc.passed_checks + '</h3><p>Passed</p></div></div>';
    html += '<div class="col-sm-4 text-center"><div class="stat-box failed"><h3>' + frm.doc.failed_checks + '</h3><p>Failed</p></div></div>';
    html += '</div>';
    
    // Quality score
    html += '<div class="row">';
    html += '<div class="col-sm-12">';
    html += '<div class="quality-score text-center"><h2>' + frm.doc.quality_score.toFixed(2) + '%</h2><p>Quality Score</p></div>';
    
    // Progress bar
    html += '<div class="progress" style="height: 20px; margin: 15px 0;">';
    let score_color = frm.doc.quality_score >= 90 ? 'bg-success' : (frm.doc.quality_score >= 70 ? 'bg-warning' : 'bg-danger');
    html += '<div class="progress-bar ' + score_color + '" role="progressbar" style="width: ' + frm.doc.quality_score + '%;" aria-valuenow="' + frm.doc.quality_score + '" aria-valuemin="0" aria-valuemax="100">' + frm.doc.quality_score.toFixed(2) + '%</div>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
    
    // Critical failures
    let critical_failures = frm.doc.checklist_items.filter(item => item.status === "Fail" && item.is_critical);
    if (critical_failures.length > 0) {
        html += '<div class="row">';
        html += '<div class="col-sm-12">';
        html += '<div class="critical-failures">';
        html += '<h4 class="text-danger">Critical Failures (' + critical_failures.length + ')</h4>';
        html += '<ul class="list-group">';
        critical_failures.forEach(function(item) {
            html += '<li class="list-group-item list-group-item-danger">' + item.check_name + '</li>';
        });
        html += '</ul>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
    }
    
    html += '</div>';
    
    // Add styles
    html += `
        <style>
            .inspection-summary {
                padding: 15px;
            }
            .stat-box {
                border: 1px solid #d1d8dd;
                border-radius: 5px;
                padding: 10px;
                margin-bottom: 15px;
            }
            .stat-box h3 {
                font-size: 24px;
                margin: 5px 0;
            }
            .stat-box p {
                margin: 5px 0;
                color: #6c757d;
            }
            .stat-box.passed {
                background-color: #e8f5e9;
            }
            .stat-box.failed {
                background-color: #ffebee;
            }
            .quality-score h2 {
                font-size: 36px;
                margin: 5px 0;
                color: ${frm.doc.quality_score >= 90 ? '#2e7d32' : (frm.doc.quality_score >= 70 ? '#ff8f00' : '#c62828')};
            }
            .quality-score p {
                margin: 5px 0;
                color: #6c757d;
            }
            .critical-failures {
                margin-top: 15px;
            }
        </style>
    `;
    
    d.fields_dict.summary_html.$wrapper.html(html);
    d.show();
} 