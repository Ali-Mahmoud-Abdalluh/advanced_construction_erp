frappe.ui.form.on('Construction Project Budget', {
    refresh: function(frm) {
        // Add custom buttons
        frm.add_custom_button(__('Update Actual Cost'), function() {
            frappe.call({
                method: "update_actual_cost",
                doc: frm.doc,
                callback: function(r) {
                    frm.refresh();
                    frappe.show_alert(__('Actual cost updated'));
                }
            });
        }, __('Actions'));
        
        frm.add_custom_button(__('View Purchase Orders'), function() {
            show_purchase_orders(frm);
        }, __('View'));
        
        frm.add_custom_button(__('Cost Forecast'), function() {
            show_cost_forecast(frm);
        }, __('View'));
        
        frm.add_custom_button(__('Cost Trend'), function() {
            show_cost_trend(frm);
        }, __('View'));
        
        // Show budget variance indicators
        if (frm.doc.variance) {
            let variance_label = frm.doc.variance > 0 ? 
                __('Over Budget: {0}', [format_currency(frm.doc.variance)]) : 
                __('Under Budget: {0}', [format_currency(Math.abs(frm.doc.variance))]);
                
            let indicator_color = frm.doc.variance > 0 ? 'red' : 'green';
            frm.dashboard.add_indicator(variance_label, indicator_color);
            
            if (frm.doc.variance_percentage) {
                frm.dashboard.add_indicator(
                    __('Variance: {0}%', [frm.doc.variance_percentage.toFixed(2)]),
                    indicator_color
                );
            }
        }
    },
    
    validate: function(frm) {
        calculate_amount(frm);
    },
    
    quantity: function(frm) {
        calculate_amount(frm);
    },
    
    rate: function(frm) {
        calculate_amount(frm);
    },
    
    item_code: function(frm) {
        if (frm.doc.item_code) {
            frappe.call({
                method: "frappe.client.get",
                args: {
                    doctype: "Item",
                    name: frm.doc.item_code
                },
                callback: function(r) {
                    if (r.message) {
                        frm.set_value('item_name', r.message.item_name);
                        if (!frm.doc.unit) {
                            frm.set_value('unit', r.message.stock_uom);
                        }
                        
                        // Check if there's a standard rate
                        if (r.message.standard_rate) {
                            frm.set_value('rate', r.message.standard_rate);
                        }
                        
                        // Check for last purchase rate
                        frappe.call({
                            method: "frappe.client.get_value",
                            args: {
                                doctype: "Item Price",
                                filters: {
                                    item_code: frm.doc.item_code,
                                    buying: 1
                                },
                                fieldname: "price_list_rate"
                            },
                            callback: function(r) {
                                if (r.message && r.message.price_list_rate) {
                                    frappe.confirm(
                                        __('Use last purchase rate of {0}?', [format_currency(r.message.price_list_rate)]),
                                        function() {
                                            frm.set_value('rate', r.message.price_list_rate);
                                        }
                                    );
                                }
                            }
                        });
                    }
                }
            });
        }
    },
    
    budget_category: function(frm) {
        if (frm.doc.budget_category) {
            frappe.call({
                method: "frappe.client.get",
                args: {
                    doctype: "Project Budget Category",
                    name: frm.doc.budget_category
                },
                callback: function(r) {
                    if (r.message && r.message.budget_limit) {
                        frm.dashboard.add_comment(
                            __('Category budget limit: {0}', [format_currency(r.message.budget_limit)]),
                            'blue'
                        );
                    }
                }
            });
        }
    }
});

function calculate_amount(frm) {
    if (frm.doc.quantity && frm.doc.rate) {
        frm.set_value('amount', flt(frm.doc.quantity) * flt(frm.doc.rate));
    }
}

function show_purchase_orders(frm) {
    frappe.call({
        method: "get_purchase_orders",
        doc: frm.doc,
        callback: function(r) {
            if (r.message && r.message.length) {
                let purchase_orders = r.message;
                
                let d = new frappe.ui.Dialog({
                    title: __('Purchase Orders'),
                    fields: [
                        {
                            fieldname: 'po_html',
                            fieldtype: 'HTML'
                        }
                    ]
                });
                
                let html = '<table class="table table-bordered">';
                html += `
                    <thead>
                        <tr>
                            <th>${__('Purchase Order')}</th>
                            <th>${__('Quantity')}</th>
                            <th>${__('Rate')}</th>
                            <th>${__('Amount')}</th>
                            <th>${__('Received')}</th>
                        </tr>
                    </thead>
                    <tbody>
                `;
                
                purchase_orders.forEach(po => {
                    html += `
                        <tr>
                            <td>
                                <a href="#Form/Purchase Order/${po.parent}">${po.parent}</a>
                            </td>
                            <td>${po.qty}</td>
                            <td>${format_currency(po.rate)}</td>
                            <td>${format_currency(po.amount)}</td>
                            <td>${po.received_qty || 0}</td>
                        </tr>
                    `;
                });
                
                html += '</tbody></table>';
                
                d.fields_dict.po_html.$wrapper.html(html);
                d.show();
            } else {
                frappe.msgprint(__('No purchase orders found for this item'));
            }
        }
    });
}

function show_cost_forecast(frm) {
    frappe.call({
        method: "forecast_cost_to_completion",
        doc: frm.doc,
        callback: function(r) {
            if (r.message !== undefined) {
                let forecast = r.message;
                
                let d = new frappe.ui.Dialog({
                    title: __('Cost Forecast'),
                    fields: [
                        {
                            fieldname: 'forecast_html',
                            fieldtype: 'HTML'
                        }
                    ]
                });
                
                let html = `
                    <div class="forecast-container">
                        <div class="row">
                            <div class="col-sm-6">
                                <div class="forecast-card">
                                    <h5>${__('Budgeted Amount')}</h5>
                                    <div class="value">${format_currency(frm.doc.amount)}</div>
                                </div>
                            </div>
                            <div class="col-sm-6">
                                <div class="forecast-card">
                                    <h5>${__('Actual Amount (to date)')}</h5>
                                    <div class="value">${format_currency(frm.doc.actual_amount || 0)}</div>
                                </div>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-sm-12">
                                <div class="forecast-card forecast">
                                    <h5>${__('Forecasted Final Cost')}</h5>
                                    <div class="value">${format_currency(forecast)}</div>
                                </div>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-sm-12">
                                <div class="forecast-card variance">
                                    <h5>${__('Forecasted Variance')}</h5>
                                    <div class="value ${forecast > frm.doc.amount ? 'text-danger' : 'text-success'}">
                                        ${format_currency(forecast - frm.doc.amount)}
                                        (${((forecast - frm.doc.amount) / frm.doc.amount * 100).toFixed(2)}%)
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <style>
                        .forecast-card {
                            border: 1px solid #d1d8dd;
                            border-radius: 4px;
                            padding: 15px;
                            margin-bottom: 15px;
                            text-align: center;
                        }
                        .forecast-card h5 {
                            margin-top: 0;
                            margin-bottom: 10px;
                        }
                        .forecast-card .value {
                            font-size: 20px;
                            font-weight: bold;
                        }
                        .forecast-card.forecast {
                            background-color: #f9f9f9;
                        }
                        .text-danger {
                            color: #ff5858;
                        }
                        .text-success {
                            color: #28a745;
                        }
                    </style>
                `;
                
                d.fields_dict.forecast_html.$wrapper.html(html);
                d.show();
            }
        }
    });
}

function show_cost_trend(frm) {
    frappe.call({
        method: "get_cost_trend",
        doc: frm.doc,
        callback: function(r) {
            if (r.message && r.message.length) {
                let trend_data = r.message;
                
                let d = new frappe.ui.Dialog({
                    title: __('Cost Trend'),
                    fields: [
                        {
                            fieldname: 'trend_html',
                            fieldtype: 'HTML'
                        }
                    ]
                });
                
                let html = `
                    <div class="trend-container">
                        <div id="trend-chart" style="height: 300px;"></div>
                    </div>
                `;
                
                d.fields_dict.trend_html.$wrapper.html(html);
                d.show();
                
                // Create chart
                setTimeout(function() {
                    new frappe.Chart("#trend-chart", {
                        title: __("Budget vs Actual Cost Trend"),
                        data: {
                            labels: trend_data.map(d => frappe.datetime.str_to_user(d.date)),
                            datasets: [
                                {
                                    name: __("Budget"),
                                    values: trend_data.map(d => d.amount)
                                },
                                {
                                    name: __("Actual"),
                                    values: trend_data.map(d => d.actual_amount || 0)
                                }
                            ]
                        },
                        type: 'line',
                        colors: ['#7cd6fd', '#ff5858'],
                        height: 300,
                        axisOptions: {
                            xIsSeries: true
                        }
                    });
                }, 500);
            } else {
                frappe.msgprint(__('No historical data found for cost trend'));
            }
        }
    });
} 