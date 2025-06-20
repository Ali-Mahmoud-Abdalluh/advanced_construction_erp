frappe.ui.form.on('Preliminary Estimate', {
    refresh: function(frm) {
        // Custom buttons based on document state
        if(frm.doc.docstatus === 0) {
            // Draft state
            if(frm.doc.based_on_conceptual_estimate && frm.doc.conceptual_estimate) {
                frm.add_custom_button(__('Import from Conceptual Estimate'), function() {
                    frm.call({
                        doc: frm.doc,
                        method: 'import_from_conceptual_estimate',
                        callback: function(r) {
                            frm.refresh();
                        }
                    });
                });
            }
        } else if(frm.doc.docstatus === 1) {
            // Submitted state
            if(frm.doc.status === 'Submitted') {
                frm.add_custom_button(__('Approve'), function() {
                    frm.call({
                        doc: frm.doc,
                        method: 'approve',
                        callback: function(r) {
                            frm.refresh();
                        }
                    });
                }).addClass('btn-primary');
                
                frm.add_custom_button(__('Reject'), function() {
                    frappe.prompt({
                        fieldtype: 'Text',
                        label: __('Rejection Reason'),
                        fieldname: 'reason',
                        reqd: 1
                    }, function(values) {
                        frm.call({
                            doc: frm.doc,
                            method: 'reject',
                            args: {
                                reason: values.reason
                            },
                            callback: function(r) {
                                frm.refresh();
                            }
                        });
                    }, __('Provide Rejection Reason'));
                });
            }
            
            if(frm.doc.status === 'Approved' || frm.doc.status === 'Rejected') {
                frm.add_custom_button(__('Create New Revision'), function() {
                    frm.call({
                        doc: frm.doc,
                        method: 'create_new_revision',
                        callback: function(r) {
                            if(r.message) {
                                frappe.model.sync(r.message);
                                frappe.set_route('Form', r.message.doctype, r.message.name);
                            }
                        }
                    });
                });
            }
        }
        
        // Add button to generate a detailed estimate
        if(frm.doc.docstatus === 1 && frm.doc.status === 'Approved') {
            frm.add_custom_button(__('Create Detailed Estimate'), function() {
                frappe.model.open_mapped_doc({
                    method: "advanced_construction_erp.construction_estimation.doctype.preliminary_estimate.preliminary_estimate.make_detailed_estimate",
                    frm: frm
                });
            });
        }
    },
    
    setup: function(frm) {
        frm.set_query('conceptual_estimate', function() {
            return {
                filters: {
                    'docstatus': 1,
                    'status': 'Approved',
                    'project': frm.doc.project
                }
            };
        });
    },
    
    validate: function(frm) {
        // Additional client-side validation if needed
    },
    
    based_on_conceptual_estimate: function(frm) {
        if(!frm.doc.based_on_conceptual_estimate) {
            frm.set_value('conceptual_estimate', '');
        }
    },
    
    // Refresh calculation when key fields change
    overhead_percentage: function(frm) {
        frm.trigger('calculate_totals');
    },
    
    profit_percentage: function(frm) {
        frm.trigger('calculate_totals');
    },
    
    contingency_percentage: function(frm) {
        frm.trigger('calculate_totals');
    },
    
    calculate_totals: function(frm) {
        // Only trigger server-side calculation if we have items
        if(frm.doc.estimate_items && frm.doc.estimate_items.length > 0) {
            frm.call({
                doc: frm.doc,
                method: 'calculate_costs',
                callback: function(r) {
                    frm.refresh_fields();
                }
            });
        }
    }
});

// Child table handler for Preliminary Estimate Item
frappe.ui.form.on('Preliminary Estimate Item', {
    estimate_items_add: function(frm, cdt, cdn) {
        // Initialize any default values
    },
    
    quantity: function(frm, cdt, cdn) {
        calculate_item_totals(frm, cdt, cdn);
    },
    
    material_cost_per_unit: function(frm, cdt, cdn) {
        calculate_item_totals(frm, cdt, cdn);
    },
    
    labor_hours_per_unit: function(frm, cdt, cdn) {
        calculate_item_totals(frm, cdt, cdn);
    },
    
    labor_rate_per_hour: function(frm, cdt, cdn) {
        calculate_item_totals(frm, cdt, cdn);
    },
    
    equipment_hours_per_unit: function(frm, cdt, cdn) {
        calculate_item_totals(frm, cdt, cdn);
    },
    
    equipment_rate_per_hour: function(frm, cdt, cdn) {
        calculate_item_totals(frm, cdt, cdn);
    },
    
    subcontractor_cost_per_unit: function(frm, cdt, cdn) {
        calculate_item_totals(frm, cdt, cdn);
    }
});

// Helper function to calculate item totals
function calculate_item_totals(frm, cdt, cdn) {
    var item = locals[cdt][cdn];
    
    // Calculate individual component costs
    item.total_material_cost = flt(item.material_cost_per_unit) * flt(item.quantity);
    item.total_labor_cost = flt(item.labor_hours_per_unit) * flt(item.labor_rate_per_hour) * flt(item.quantity);
    
    if(item.equipment_hours_per_unit && item.equipment_rate_per_hour) {
        item.total_equipment_cost = flt(item.equipment_hours_per_unit) * flt(item.equipment_rate_per_hour) * flt(item.quantity);
    } else {
        item.total_equipment_cost = 0;
    }
    
    if(item.subcontractor_cost_per_unit) {
        item.total_subcontractor_cost = flt(item.subcontractor_cost_per_unit) * flt(item.quantity);
    } else {
        item.total_subcontractor_cost = 0;
    }
    
    // Calculate totals
    item.total_cost_per_unit = (
        flt(item.material_cost_per_unit) + 
        (flt(item.labor_hours_per_unit) * flt(item.labor_rate_per_hour)) +
        (flt(item.equipment_hours_per_unit) * flt(item.equipment_rate_per_hour)) +
        flt(item.subcontractor_cost_per_unit)
    );
    
    item.total_cost = flt(item.total_cost_per_unit) * flt(item.quantity);
    
    refresh_field('estimate_items');
    frm.trigger('calculate_totals');
} 