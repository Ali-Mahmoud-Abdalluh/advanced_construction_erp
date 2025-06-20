// Copyright (c) 2023, Your Company and contributors
// For license information, please see license.txt

frappe.ui.form.on('Risk Factor', {
	refresh: function(frm) {
		// Add custom buttons or indicators if needed
		
		// Set indicator color based on risk level
		frm.set_indicator_formatter('risk_level',
			function(doc) {
				let colors = {
					'Low': 'green',
					'Medium': 'blue',
					'High': 'orange',
					'Critical': 'red'
				};
				return colors[doc.risk_level] || 'gray';
			}
		);
		
		// Add button to suggest mitigation strategies
		if (!frm.is_new() && (frm.doc.risk_level === 'High' || frm.doc.risk_level === 'Critical')) {
			frm.add_custom_button(__('Suggest Mitigation'), function() {
				frappe.call({
					method: "suggest_mitigation",
					doc: frm.doc,
					callback: function(r) {
						if (r.message) {
							if (!frm.doc.mitigation_strategy) {
								frm.set_value('mitigation_strategy', r.message);
							} else {
								frappe.msgprint(__("Suggested Mitigation: {0}", [r.message]));
							}
						}
					}
				});
			});
		}
	},
	
	probability: function(frm) {
		// Recalculate risk score when probability changes
		calculate_risk_score(frm);
	},
	
	impact: function(frm) {
		// Recalculate risk score when impact changes
		calculate_risk_score(frm);
	},
	
	risk_category: function(frm) {
		// Suggest risk owner based on category
		if (frm.doc.risk_category) {
			let suggested_owners = {
				'Financial': 'Finance Manager',
				'Technical': 'Technical Director',
				'Schedule': 'Project Manager',
				'Safety': 'Safety Officer',
				'Quality': 'Quality Manager',
				'Environmental': 'Environmental Specialist',
				'Regulatory': 'Compliance Officer',
				'Resource': 'Resource Manager'
			};
			
			if (suggested_owners[frm.doc.risk_category] && !frm.doc.risk_owner) {
				frm.set_value('risk_owner', suggested_owners[frm.doc.risk_category]);
			}
		}
	}
});

function calculate_risk_score(frm) {
	if (frm.doc.probability !== undefined && frm.doc.impact !== undefined) {
		let score = flt(frm.doc.probability) * flt(frm.doc.impact);
		frm.set_value('risk_score', score);
		
		// Set risk level based on score
		let risk_level = 'Low';
		if (score < 3) {
			risk_level = 'Low';
		} else if (score < 6) {
			risk_level = 'Medium';
		} else if (score < 9) {
			risk_level = 'High';
		} else {
			risk_level = 'Critical';
		}
		
		frm.set_value('risk_level', risk_level);
	}
}