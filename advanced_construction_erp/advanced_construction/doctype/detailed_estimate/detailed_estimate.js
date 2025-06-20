frappe.ui.form.on('Detailed Estimate', {
    refresh: function(frm) {
        // Custom buttons based on document state
        if(frm.doc.docstatus === 0) {
            // Draft state
            if(frm.doc.based_on_preliminary_estimate && frm.doc.preliminary_estimate) {
                frm.add_custom_button(__('Import from Preliminary Estimate'), function() {
                    frm.call({
                        doc: frm.doc,
                        method: 'import_from_preliminary_estimate',
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
        
        // Add action buttons when estimate is approved
        if(frm.doc.docstatus === 1 && frm.doc.status === 'Approved') {
            frm.add_custom_button(__('Create Master BOQ'), function() {
                frappe.model.open_mapped_doc({
                    method: "advanced_construction_erp.construction_estimation.doctype.detailed_estimate.detailed_estimate.make_master_boq",
                    frm: frm
                });
            });
            
            frm.add_custom_button(__('Export to Excel'), function() {
                open_url_post('/api/method/advanced_construction_erp.construction_estimation.doctype.detailed_estimate.detailed_estimate.export_to_excel', {
                    detailed_estimate: frm.doc.name
                });
            });
        }
    },
    
    setup: function(frm) {
        frm.set_query('preliminary_estimate', function() {
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
    
    based_on_preliminary_estimate: function(frm) {
        if(!frm.doc.based_on_preliminary_estimate) {
            frm.set_value('preliminary_estimate', '');
        }
    },
    
    gross_floor_area: function(frm) {
        calculate_cost_per_square_meter(frm);
    },
    
    // Refresh calculation when key fields change
    general_requirements_percentage: function(frm) {
        frm.trigger('calculate_totals');
    },
    
    overhead_percentage: function(frm) {
        frm.trigger('calculate_totals');
    },
    
    profit_percentage: function(frm) {
        frm.trigger('calculate_totals');
    },
    
    bond_percentage: function(frm) {
        frm.trigger('calculate_totals');
    },
    
    tax_percentage: function(frm) {
        frm.trigger('calculate_totals');
    },
    
    contingency_percentage: function(frm) {
        frm.trigger('calculate_totals');
    },
    
    escalation_percentage: function(frm) {
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
                    calculate_cost_per_square_meter(frm);
                }
            });
        }
    }
});

// Child table handler for Detailed Estimate Item
frappe.ui.form.on('Detailed Estimate Item', {
    estimate_items_add: function(frm, cdt, cdn) {
        // Initialize any default values
        frappe.model.set_value(cdt, cdn, 'material_waste_percentage', 5);
        frappe.model.set_value(cdt, cdn, 'labor_productivity_factor', 1);
        frappe.model.set_value(cdt, cdn, 'equipment_efficiency_factor', 1);
        frappe.model.set_value(cdt, cdn, 'subcontractor_markup_percentage', 10);
    },
    
    quantity: function(frm, cdt, cdn) {
        calculate_item_totals(frm, cdt, cdn);
    },
    
    material_quantity: function(frm, cdt, cdn) {
        calculate_material_amount(frm, cdt, cdn);
    },
    
    material_rate: function(frm, cdt, cdn) {
        calculate_material_amount(frm, cdt, cdn);
    },
    
    material_waste_percentage: function(frm, cdt, cdn) {
        calculate_material_amount(frm, cdt, cdn);
    },
    
    labor_hours: function(frm, cdt, cdn) {
        calculate_labor_amount(frm, cdt, cdn);
    },
    
    labor_rate: function(frm, cdt, cdn) {
        calculate_labor_amount(frm, cdt, cdn);
    },
    
    labor_productivity_factor: function(frm, cdt, cdn) {
        calculate_labor_amount(frm, cdt, cdn);
    },
    
    equipment_hours: function(frm, cdt, cdn) {
        calculate_equipment_amount(frm, cdt, cdn);
    },
    
    equipment_rate: function(frm, cdt, cdn) {
        calculate_equipment_amount(frm, cdt, cdn);
    },
    
    equipment_efficiency_factor: function(frm, cdt, cdn) {
        calculate_equipment_amount(frm, cdt, cdn);
    },
    
    subcontractor_quote_amount: function(frm, cdt, cdn) {
        calculate_subcontractor_amount(frm, cdt, cdn);
    },
    
    subcontractor_markup_percentage: function(frm, cdt, cdn) {
        calculate_subcontractor_amount(frm, cdt, cdn);
    }
});

// Helper functions for calculations
function calculate_material_amount(frm, cdt, cdn) {
    var item = locals[cdt][cdn];
    
    if(item.material_rate && item.material_quantity) {
        item.material_amount = flt(item.material_rate) * flt(item.material_quantity);
        item.material_waste_amount = flt(item.material_amount) * (flt(item.material_waste_percentage) / 100);
        item.total_material_amount = flt(item.material_amount) + flt(item.material_waste_amount);
    } else {
        item.material_amount = 0;
        item.material_waste_amount = 0;
        item.total_material_amount = 0;
    }
    
    calculate_item_totals(frm, cdt, cdn);
}

function calculate_labor_amount(frm, cdt, cdn) {
    var item = locals[cdt][cdn];
    
    if(item.labor_hours && item.labor_rate) {
        item.labor_amount = flt(item.labor_hours) * flt(item.labor_rate);
        item.labor_productivity_amount = flt(item.labor_amount) * (flt(item.labor_productivity_factor) - 1);
        item.total_labor_amount = flt(item.labor_amount) + flt(item.labor_productivity_amount);
    } else {
        item.labor_amount = 0;
        item.labor_productivity_amount = 0;
        item.total_labor_amount = 0;
    }
    
    calculate_item_totals(frm, cdt, cdn);
}

function calculate_equipment_amount(frm, cdt, cdn) {
    var item = locals[cdt][cdn];
    
    if(item.equipment_hours && item.equipment_rate) {
        item.equipment_amount = flt(item.equipment_hours) * flt(item.equipment_rate);
        item.equipment_efficiency_amount = flt(item.equipment_amount) * (flt(item.equipment_efficiency_factor) - 1);
        item.total_equipment_amount = flt(item.equipment_amount) + flt(item.equipment_efficiency_amount);
    } else {
        item.equipment_amount = 0;
        item.equipment_efficiency_amount = 0;
        item.total_equipment_amount = 0;
    }
    
    calculate_item_totals(frm, cdt, cdn);
}

function calculate_subcontractor_amount(frm, cdt, cdn) {
    var item = locals[cdt][cdn];
    
    if(item.subcontractor_quote_amount) {
        item.subcontractor_markup_amount = flt(item.subcontractor_quote_amount) * (flt(item.subcontractor_markup_percentage) / 100);
        item.total_subcontractor_amount = flt(item.subcontractor_quote_amount) + flt(item.subcontractor_markup_amount);
    } else {
        item.subcontractor_markup_amount = 0;
        item.total_subcontractor_amount = 0;
    }
    
    calculate_item_totals(frm, cdt, cdn);
}

function calculate_item_totals(frm, cdt, cdn) {
    var item = locals[cdt][cdn];
    
    // Calculate unit cost and total cost
    item.unit_cost = (
        flt(item.total_material_amount) + 
        flt(item.total_labor_amount) + 
        flt(item.total_equipment_amount) + 
        flt(item.total_subcontractor_amount)
    ) / flt(item.quantity) if flt(item.quantity) else 0;
    
    item.total_cost = flt(item.unit_cost) * flt(item.quantity);
    
    refresh_field('estimate_items');
    frm.trigger('calculate_totals');
}

function calculate_cost_per_square_meter(frm) {
    if(frm.doc.gross_floor_area && flt(frm.doc.gross_floor_area) > 0 && frm.doc.total_estimated_cost) {
        frm.set_value('cost_per_square_meter', flt(frm.doc.total_estimated_cost) / flt(frm.doc.gross_floor_area));
    } else {
        frm.set_value('cost_per_square_meter', 0);
    }
} 