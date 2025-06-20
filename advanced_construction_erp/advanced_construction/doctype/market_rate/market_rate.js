frappe.ui.form.on('Market Rate', {
    refresh: function(frm) {
        // Add custom buttons
        frm.add_custom_button(__('View Rate History'), function() {
            frappe.call({
                method: 'get_rate_history',
                doc: frm.doc,
                callback: function(r) {
                    if (r.message) {
                        show_rate_history(r.message);
                    }
                }
            });
        }, __('Analyze'));
        
        frm.add_custom_button(__('View Rate Trend'), function() {
            frappe.call({
                method: 'get_rate_trend',
                doc: frm.doc,
                callback: function(r) {
                    if (r.message) {
                        show_rate_trend(r.message);
                    }
                }
            });
        }, __('Analyze'));
    },
    
    item_code: function(frm) {
        // Fetch item details when item code is selected
        if (frm.doc.item_code) {
            frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Item',
                    name: frm.doc.item_code
                },
                callback: function(r) {
                    if (r.message) {
                        frm.set_value('item_name', r.message.item_name);
                        frm.set_value('unit', r.message.stock_uom);
                    }
                }
            });
        }
    },
    
    valid_from: function(frm) {
        // Validate valid from date
        if (frm.doc.valid_from && frm.doc.valid_to) {
            if (frm.doc.valid_from > frm.doc.valid_to) {
                frappe.msgprint(__('Valid From date cannot be after Valid To date'));
                frm.set_value('valid_from', '');
            }
        }
    },
    
    valid_to: function(frm) {
        // Validate valid to date
        if (frm.doc.valid_from && frm.doc.valid_to) {
            if (frm.doc.valid_from > frm.doc.valid_to) {
                frappe.msgprint(__('Valid To date cannot be before Valid From date'));
                frm.set_value('valid_to', '');
            }
        }
    },
    
    is_active: function(frm) {
        // Confirm before deactivating
        if (!frm.doc.is_active && frm.doc.__islocal) {
            frappe.confirm(
                __('Are you sure you want to deactivate this market rate?'),
                function() {
                    // User confirmed
                },
                function() {
                    // User cancelled
                    frm.set_value('is_active', 1);
                }
            );
        }
    }
});

function show_rate_history(rates) {
    // Create a dialog to show rate history
    let d = new frappe.ui.Dialog({
        title: __('Rate History'),
        size: 'large',
        fields: [
            {
                fieldname: 'rate_history',
                fieldtype: 'HTML',
                options: get_rate_history_html(rates)
            }
        ]
    });
    
    d.show();
}

function get_rate_history_html(rates) {
    let html = `
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>${__('Valid From')}</th>
                    <th>${__('Valid To')}</th>
                    <th>${__('Rate')}</th>
                    <th>${__('Supplier')}</th>
                    <th>${__('Location')}</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    rates.forEach(rate => {
        html += `
            <tr>
                <td>${rate.valid_from}</td>
                <td>${rate.valid_to || '-'}</td>
                <td>${format_currency(rate.rate)}</td>
                <td>${rate.supplier || '-'}</td>
                <td>${rate.location || '-'}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    return html;
}

function show_rate_trend(trend_data) {
    // Create a dialog to show rate trend
    let d = new frappe.ui.Dialog({
        title: __('Rate Trend Analysis'),
        size: 'large',
        fields: [
            {
                fieldname: 'trend_chart',
                fieldtype: 'HTML',
                options: get_trend_chart_html(trend_data)
            }
        ]
    });
    
    d.show();
}

function get_trend_chart_html(trend_data) {
    // Create a chart using Chart.js
    let html = `
        <canvas id="rateTrendChart" style="width: 100%; height: 300px;"></canvas>
        <script>
            new Chart(document.getElementById('rateTrendChart'), {
                type: 'line',
                data: {
                    labels: ${JSON.stringify(trend_data.map(d => d.period))},
                    datasets: [{
                        label: '${__('Average Rate')}',
                        data: ${JSON.stringify(trend_data.map(d => d.mean))},
                        borderColor: '#1a73e8',
                        fill: false
                    }, {
                        label: '${__('Minimum Rate')}',
                        data: ${JSON.stringify(trend_data.map(d => d.min))},
                        borderColor: '#34a853',
                        fill: false
                    }, {
                        label: '${__('Maximum Rate')}',
                        data: ${JSON.stringify(trend_data.map(d => d.max))},
                        borderColor: '#ea4335',
                        fill: false
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: false,
                            ticks: {
                                callback: function(value) {
                                    return format_currency(value);
                                }
                            }
                        }
                    }
                }
            });
        </script>
    `;
    
    return html;
} 