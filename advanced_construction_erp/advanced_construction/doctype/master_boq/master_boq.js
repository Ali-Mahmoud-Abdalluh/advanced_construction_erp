frappe.ui.form.on('Master BOQ', {
    refresh: function(frm) {
        // Custom buttons based on document state
        if(frm.doc.docstatus === 0) {
            // Draft state
            if(frm.doc.based_on_detailed_estimate && frm.doc.detailed_estimate) {
                frm.add_custom_button(__('Import from Detailed Estimate'), function() {
                    frm.call({
                        doc: frm.doc,
                        method: 'import_from_detailed_estimate',
                        callback: function(r) {
                            frm.refresh();
                        }
                    });
                });
            }
            
            // Add button to verify all quantities
            if(frm.doc.enable_quantity_verification) {
                frm.add_custom_button(__('Verify All Quantities'), function() {
                    verify_all_quantities(frm, true);
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
            
            // Export to Excel
            frm.add_custom_button(__('Export to Excel'), function() {
                open_url_post('/api/method/advanced_construction_erp.construction_estimation.doctype.master_boq.master_boq.export_to_excel', {
                    master_boq: frm.doc.name
                });
            });
        }
        
        // Add custom buttons for hierarchical BOQ
        if(frm.doc.allow_hierarchical_items && frm.doc.docstatus === 0) {
            frm.add_custom_button(__('Add Section'), function() {
                add_boq_section(frm);
            });
            
            frm.add_custom_button(__('Add Subsection'), function() {
                add_boq_subsection(frm);
            });
            
            frm.add_custom_button(__('Indent Item'), function() {
                indent_boq_item(frm);
            });
            
            frm.add_custom_button(__('Outdent Item'), function() {
                outdent_boq_item(frm);
            });
        }
    },
    
    setup: function(frm) {
        frm.set_query('detailed_estimate', function() {
            return {
                filters: {
                    'docstatus': 1,
                    'status': 'Approved',
                    'project': frm.doc.project
                }
            };
        });
        
        // Set parent_item filter to show only group items
        frm.set_query('parent_item', 'boq_items', function(doc, cdt, cdn) {
            let d = locals[cdt][cdn];
            return {
                filters: {
                    'is_group': 1,
                    'name': ['!=', d.name] // Prevent circular references
                }
            };
        });
    },
    
    allow_hierarchical_items: function(frm) {
        frm.trigger('calculate_totals');
    },
    
    based_on_detailed_estimate: function(frm) {
        if(!frm.doc.based_on_detailed_estimate) {
            frm.set_value('detailed_estimate', '');
        }
    },
    
    calculate_totals: function(frm) {
        frm.call({
            doc: frm.doc,
            method: 'update_item_amounts',
            callback: function(r) {
                frm.call({
                    doc: frm.doc,
                    method: 'calculate_total_amount',
                    callback: function(r) {
                        frm.refresh_fields();
                    }
                });
            }
        });
    }
});

// Child table handler for BOQ Item
frappe.ui.form.on('BOQ Item', {
    boq_items_add: function(frm, cdt, cdn) {
        // Initialize any default values
    },
    
    quantity: function(frm, cdt, cdn) {
        calculate_amount(frm, cdt, cdn);
    },
    
    rate: function(frm, cdt, cdn) {
        calculate_amount(frm, cdt, cdn);
    },
    
    alternative_rate_1: function(frm, cdt, cdn) {
        calculate_alternative_amount(frm, cdt, cdn, 1);
    },
    
    alternative_rate_2: function(frm, cdt, cdn) {
        calculate_alternative_amount(frm, cdt, cdn, 2);
    },
    
    alternative_rate_3: function(frm, cdt, cdn) {
        calculate_alternative_amount(frm, cdt, cdn, 3);
    },
    
    is_group: function(frm, cdt, cdn) {
        let d = locals[cdt][cdn];
        if(d.is_group) {
            // If item is marked as group, clear parent_item
            frappe.model.set_value(cdt, cdn, 'parent_item', '');
        }
    },
    
    parent_item: function(frm, cdt, cdn) {
        let d = locals[cdt][cdn];
        if(d.parent_item) {
            // If item has a parent, it cannot be a group
            frappe.model.set_value(cdt, cdn, 'is_group', 0);
        }
    }
});

// Helper functions

function calculate_amount(frm, cdt, cdn) {
    let item = locals[cdt][cdn];
    
    // Calculate main amount
    let amount = flt(item.quantity) * flt(item.rate);
    frappe.model.set_value(cdt, cdn, 'amount', amount);
    
    // Also update alternative amounts
    calculate_alternative_amount(frm, cdt, cdn, 1);
    calculate_alternative_amount(frm, cdt, cdn, 2);
    calculate_alternative_amount(frm, cdt, cdn, 3);
    
    frm.trigger('calculate_totals');
}

function calculate_alternative_amount(frm, cdt, cdn, alt_number) {
    let item = locals[cdt][cdn];
    let rate_field = 'alternative_rate_' + alt_number;
    let amount_field = 'alternative_amount_' + alt_number;
    
    if(item[rate_field]) {
        let amount = flt(item.quantity) * flt(item[rate_field]);
        frappe.model.set_value(cdt, cdn, amount_field, amount);
    } else {
        frappe.model.set_value(cdt, cdn, amount_field, 0);
    }
}

function verify_all_quantities(frm, verified) {
    if(!frm.doc.enable_quantity_verification) {
        frappe.msgprint(__('Quantity verification is not enabled for this BOQ.'));
        return;
    }
    
    // Verify each item's quantity
    for(let i = 0; i < frm.doc.boq_items.length; i++) {
        frm.call({
            doc: frm.doc,
            method: 'verify_quantity',
            args: {
                'item_idx': i,
                'verified': verified
            },
            callback: function(r) {
                if(i === frm.doc.boq_items.length - 1) {
                    frm.refresh();
                }
            }
        });
    }
}

function add_boq_section(frm) {
    let d = new frappe.ui.Dialog({
        title: __('Add BOQ Section'),
        fields: [
            {
                label: __('Section Code'),
                fieldname: 'item_code',
                fieldtype: 'Data',
                reqd: 1
            },
            {
                label: __('Section Name'),
                fieldname: 'item_name',
                fieldtype: 'Data',
                reqd: 1
            }
        ],
        primary_action_label: __('Add'),
        primary_action: function() {
            let values = d.get_values();
            
            frm.add_child('boq_items', {
                'item_type': 'Section',
                'is_group': 1,
                'item_code': values.item_code,
                'item_name': values.item_name,
                'quantity': 1,
                'unit': 'ls',
                'rate': 0,
                'amount': 0
            });
            
            frm.refresh_field('boq_items');
            d.hide();
            
            frm.trigger('calculate_totals');
        }
    });
    
    d.show();
}

function add_boq_subsection(frm) {
    // Get list of available parent sections
    let sections = [];
    for(let i = 0; i < frm.doc.boq_items.length; i++) {
        let item = frm.doc.boq_items[i];
        if(item.is_group && item.item_type === 'Section') {
            sections.push({
                'value': item.name,
                'label': item.item_name + ' (' + item.item_code + ')'
            });
        }
    }
    
    if(sections.length === 0) {
        frappe.msgprint(__('Please add a section first.'));
        return;
    }
    
    let d = new frappe.ui.Dialog({
        title: __('Add BOQ Subsection'),
        fields: [
            {
                label: __('Parent Section'),
                fieldname: 'parent_item',
                fieldtype: 'Select',
                options: sections,
                reqd: 1
            },
            {
                label: __('Subsection Code'),
                fieldname: 'item_code',
                fieldtype: 'Data',
                reqd: 1
            },
            {
                label: __('Subsection Name'),
                fieldname: 'item_name',
                fieldtype: 'Data',
                reqd: 1
            }
        ],
        primary_action_label: __('Add'),
        primary_action: function() {
            let values = d.get_values();
            
            frm.add_child('boq_items', {
                'item_type': 'Subsection',
                'is_group': 1,
                'parent_item': values.parent_item,
                'item_code': values.item_code,
                'item_name': values.item_name,
                'quantity': 1,
                'unit': 'ls',
                'rate': 0,
                'amount': 0
            });
            
            frm.refresh_field('boq_items');
            d.hide();
            
            frm.trigger('calculate_totals');
        }
    });
    
    d.show();
}

function indent_boq_item(frm) {
    let selected_items = frm.get_selected('boq_items');
    if(Object.keys(selected_items).length === 0) {
        frappe.msgprint(__('Please select an item to indent.'));
        return;
    }
    
    // Get list of available parent items (groups)
    let parents = [];
    for(let i = 0; i < frm.doc.boq_items.length; i++) {
        let item = frm.doc.boq_items[i];
        if(item.is_group && !selected_items[item.name]) {
            parents.push({
                'value': item.name,
                'label': item.item_name + ' (' + item.item_code + ')'
            });
        }
    }
    
    if(parents.length === 0) {
        frappe.msgprint(__('No available parent groups found.'));
        return;
    }
    
    let d = new frappe.ui.Dialog({
        title: __('Indent BOQ Item'),
        fields: [
            {
                label: __('Parent Item'),
                fieldname: 'parent_item',
                fieldtype: 'Select',
                options: parents,
                reqd: 1
            }
        ],
        primary_action_label: __('Indent'),
        primary_action: function() {
            let values = d.get_values();
            
            // Update parent for selected items
            for(let key in selected_items) {
                let idx = selected_items[key];
                frm.doc.boq_items[idx].parent_item = values.parent_item;
                frm.doc.boq_items[idx].is_group = 0; // If indented, cannot be a group
            }
            
            frm.refresh_field('boq_items');
            d.hide();
            
            frm.trigger('calculate_totals');
        }
    });
    
    d.show();
}

function outdent_boq_item(frm) {
    let selected_items = frm.get_selected('boq_items');
    if(Object.keys(selected_items).length === 0) {
        frappe.msgprint(__('Please select an item to outdent.'));
        return;
    }
    
    // Remove parent for selected items
    for(let key in selected_items) {
        let idx = selected_items[key];
        frm.doc.boq_items[idx].parent_item = null;
    }
    
    frm.refresh_field('boq_items');
    frm.trigger('calculate_totals');
} 