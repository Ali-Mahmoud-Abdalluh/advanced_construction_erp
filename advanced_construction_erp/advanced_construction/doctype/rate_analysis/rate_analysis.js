frappe.ui.form.on('Rate Analysis', {
    refresh: function(frm) {
        // Add custom buttons
        frm.add_custom_button(__('View Rate History'), function() {
            frm.trigger('show_rate_history');
        });

        frm.add_custom_button(__('View Rate Trend'), function() {
            frm.trigger('show_rate_trend');
        });

        frm.add_custom_button(__('Update Market Comparison'), function() {
            frm.trigger('update_market_comparison');
        });
    },

    item_code: function(frm) {
        if (frm.doc.item_code) {
            frappe.call({
                method: 'get_item_details',
                doc: frm.doc,
                args: {
                    item_code: frm.doc.item_code
                },
                callback: function(r) {
                    if (r.message) {
                        frm.set_value('item_name', r.message.item_name);
                    }
                }
            });
        }
    },

    show_rate_history: function(frm) {
        frappe.call({
            method: 'get_rate_history',
            doc: frm.doc,
            callback: function(r) {
                if (r.message) {
                    frm.trigger('show_rate_history_dialog', r.message);
                }
            }
        });
    },

    show_rate_trend: function(frm) {
        frappe.call({
            method: 'get_rate_trend',
            doc: frm.doc,
            callback: function(r) {
                if (r.message) {
                    frm.trigger('show_rate_trend_dialog', r.message);
                }
            }
        });
    },

    update_market_comparison: function(frm) {
        frappe.call({
            method: 'get_market_rates',
            doc: frm.doc,
            callback: function(r) {
                if (r.message) {
                    frm.trigger('update_market_comparison_table', r.message);
                }
            }
        });
    },

    show_rate_history_dialog: function(frm, rates) {
        let dialog = new frappe.ui.Dialog({
            title: __('Rate History'),
            size: 'large',
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'rate_history'
                }
            ]
        });

        let html = `<table class="table table-bordered">
            <thead>
                <tr>
                    <th>${__('Analysis Date')}</th>
                    <th>${__('Final Rate')}</th>
                    <th>${__('Status')}</th>
                </tr>
            </thead>
            <tbody>`;

        rates.forEach(rate => {
            html += `<tr>
                <td>${rate.analysis_date}</td>
                <td>${format_currency(rate.final_rate)}</td>
                <td>${rate.status}</td>
            </tr>`;
        });

        html += `</tbody></table>`;

        dialog.fields_dict.rate_history.$wrapper.html(html);
        dialog.show();
    },

    show_rate_trend_dialog: function(frm, data) {
        let dialog = new frappe.ui.Dialog({
            title: __('Rate Trend Analysis'),
            size: 'large',
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'rate_trend'
                }
            ]
        });

        // Create chart using Chart.js
        let html = `<canvas id="rateTrendChart"></canvas>`;
        dialog.fields_dict.rate_trend.$wrapper.html(html);

        dialog.show();

        // Initialize chart after dialog is shown
        setTimeout(() => {
            let ctx = document.getElementById('rateTrendChart').getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.rate_analysis.map(r => r.analysis_date),
                    datasets: [
                        {
                            label: 'Rate Analysis',
                            data: data.rate_analysis.map(r => r.final_rate),
                            borderColor: 'rgb(75, 192, 192)',
                            tension: 0.1
                        },
                        {
                            label: 'Market Rates',
                            data: data.market_rates.map(r => r.rate),
                            borderColor: 'rgb(255, 99, 132)',
                            tension: 0.1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }, 100);
    },

    update_market_comparison_table: function(frm, rates) {
        frm.clear_table('market_comparison');
        rates.forEach(rate => {
            let row = frappe.model.add_child(frm.doc, 'Market Rate Comparison', 'market_comparison');
            row.rate = rate.rate;
            row.supplier = rate.supplier;
            row.location = rate.location;
            row.valid_from = rate.valid_from;
        });
        frm.refresh_field('market_comparison');
    }
});

frappe.ui.form.on('Rate Analysis Component', {
    item_code: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.item_code) {
            frappe.call({
                method: 'get_item_details',
                doc: frm.doc,
                args: {
                    item_code: row.item_code
                },
                callback: function(r) {
                    if (r.message) {
                        frappe.model.set_value(cdt, cdn, 'item_name', r.message.item_name);
                        frappe.model.set_value(cdt, cdn, 'unit', r.message.unit);
                    }
                }
            });
        }
    },

    quantity: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.quantity && row.rate) {
            frappe.model.set_value(cdt, cdn, 'amount', flt(row.quantity) * flt(row.rate));
        }
    },

    rate: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.quantity && row.rate) {
            frappe.model.set_value(cdt, cdn, 'amount', flt(row.quantity) * flt(row.rate));
        }
    }
}); 