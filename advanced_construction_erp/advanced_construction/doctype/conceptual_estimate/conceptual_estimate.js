frappe.ui.form.on('Conceptual Estimate', {
    refresh: function(frm) {
        // Add custom buttons
        frm.add_custom_button(__('Create Detailed Estimate'), function() {
            frappe.call({
                method: 'create_detailed_estimate',
                doc: frm.doc,
                callback: function(r) {
                    if (r.message) {
                        frappe.set_route('Form', 'Detailed Estimate', r.message.name);
                    }
                }
            });
        }, __('Create'));
        
        frm.add_custom_button(__('Update from Market Rates'), function() {
            frappe.call({
                method: 'update_from_market_rates',
                doc: frm.doc,
                callback: function(r) {
                    frm.reload_doc();
                }
            });
        }, __('Update'));
        
        frm.add_custom_button(__('Compare with Historical'), function() {
            frappe.call({
                method: 'compare_with_historical',
                doc: frm.doc,
                callback: function(r) {
                    if (r.message) {
                        frappe.msgprint({
                            title: __('Historical Comparison'),
                            message: __(`Average Historical Cost: ${format_currency(r.message.average_historical_cost)}
                                Current Cost: ${format_currency(r.message.current_cost)}
                                Variance: ${r.message.variance_percentage.toFixed(2)}%`),
                            indicator: r.message.variance_percentage > 0 ? 'red' : 'green'
                        });
                    }
                }
            });
        }, __('Analyze'));
    },
    
    project: function(frm) {
        // Fetch project details when project is selected
        if (frm.doc.project) {
            frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Construction Project',
                    name: frm.doc.project
                },
                callback: function(r) {
                    if (r.message) {
                        frm.set_value('project_type', r.message.project_type);
                        frm.set_value('project_size', r.message.project_size);
                        frm.set_value('location', r.message.location);
                    }
                }
            });
        }
    },
    
    estimate_date: function(frm) {
        // Validate estimate date
        if (frm.doc.estimate_date && frm.doc.estimate_date > frappe.datetime.now_date()) {
            frappe.msgprint(__('Estimate date cannot be in the future'));
            frm.set_value('estimate_date', '');
        }
    },
    
    contingency_percentage: function(frm) {
        // Recalculate totals when contingency percentage changes
        frm.trigger('calculate_totals');
    },
    
    escalation_percentage: function(frm) {
        // Apply escalation when percentage changes
        if (frm.doc.escalation_percentage) {
            frappe.call({
                method: 'apply_escalation',
                doc: frm.doc,
                callback: function(r) {
                    frm.reload_doc();
                }
            });
        }
    }
});

frappe.ui.form.on('Conceptual Estimate Item', {
    item_code: function(frm, cdt, cdn) {
        // Fetch item details when item code is selected
        let d = locals[cdt][cdn];
        if (d.item_code) {
            frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Item',
                    name: d.item_code
                },
                callback: function(r) {
                    if (r.message) {
                        frappe.model.set_value(cdt, cdn, 'item_name', r.message.item_name);
                        frappe.model.set_value(cdt, cdn, 'unit', r.message.stock_uom);
                        
                        // Fetch current market rate
                        frappe.call({
                            method: 'frappe.client.get_value',
                            args: {
                                doctype: 'Market Rate',
                                filters: {
                                    item_code: d.item_code,
                                    is_active: 1
                                },
                                fieldname: 'rate'
                            },
                            callback: function(r) {
                                if (r.message && r.message.rate) {
                                    frappe.model.set_value(cdt, cdn, 'rate', r.message.rate);
                                }
                            }
                        });
                    }
                }
            });
        }
    },
    
    quantity: function(frm, cdt, cdn) {
        // Calculate amount when quantity changes
        let d = locals[cdt][cdn];
        if (d.quantity && d.rate) {
            frappe.model.set_value(cdt, cdn, 'amount', flt(d.quantity * d.rate));
        }
    },
    
    rate: function(frm, cdt, cdn) {
        // Calculate amount when rate changes
        let d = locals[cdt][cdn];
        if (d.quantity && d.rate) {
            frappe.model.set_value(cdt, cdn, 'amount', flt(d.quantity * d.rate));
        }
    }
}); 