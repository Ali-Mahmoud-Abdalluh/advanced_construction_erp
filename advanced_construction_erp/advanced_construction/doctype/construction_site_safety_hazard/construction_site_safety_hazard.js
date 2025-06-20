// Copyright (c) 2023, Your Company and contributors
// For license information, please see license.txt

frappe.ui.form.on('Construction Site Safety Hazard', {
	refresh: function(frm) {
		// Set indicator based on risk level
		set_risk_indicator(frm);
		
		// Add custom buttons
		frm.add_custom_button(__('Create Safety Action'), function() {
			create_safety_action(frm);
		});
		
		// Add button to suggest safety actions
		frm.add_custom_button(__('Suggest Safety Actions'), function() {
			suggest_safety_actions(frm);
		});
	},
	
	risk_level: function(frm) {
		// Update indicator when risk level changes
		set_risk_indicator(frm);
	},
	
	hazard_type: function(frm) {
		// Suggest hazard description based on type if empty
		if (frm.doc.hazard_type && !frm.doc.hazard_description) {
			let descriptions = {
				'Fall Hazard': 'Risk of falling from height due to inadequate fall protection or unsafe working conditions.',
				'Electrical Hazard': 'Risk of electrical shock or electrocution due to exposed wiring or unsafe electrical equipment.',
				'Chemical Hazard': 'Risk of exposure to harmful chemicals or substances that may cause injury, illness, or environmental damage.',
				'Fire Hazard': 'Risk of fire due to flammable materials, ignition sources, or inadequate fire prevention measures.',
				'Structural Hazard': 'Risk of structural collapse or failure that may cause injury or damage to property.',
				'Equipment Hazard': 'Risk of injury from improper use, malfunction, or lack of guarding on construction equipment.',
				'Tripping Hazard': 'Risk of tripping or falling due to uneven surfaces, debris, or poor housekeeping.',
				'Environmental Hazard': 'Risk to the environment or public due to construction activities, waste, or emissions.'
			};
			
			if (descriptions[frm.doc.hazard_type]) {
				frm.set_value('hazard_description', descriptions[frm.doc.hazard_type]);
			}
		}
	}
});

function set_risk_indicator(frm) {
	if (frm.doc.risk_level) {
		let indicator = 'gray';
		
		// Set indicator color based on risk level
		switch(frm.doc.risk_level) {
			case 'Critical':
				indicator = 'red';
				break;
			case 'High':
				indicator = 'orange';
				break;
			case 'Medium':
				indicator = 'yellow';
				break;
			case 'Low':
				indicator = 'blue';
				break;
			default:
				indicator = 'gray';
		}
		
		// Set the indicator
		frm.set_indicator(indicator, frm.doc.risk_level);
	}
}

function create_safety_action(frm) {
	// Create a new safety action based on the hazard
	frappe.new_doc('Construction Site Safety Action', {
		'action_description': 'Address ' + frm.doc.hazard_type + ': ' + frm.doc.hazard_description,
		'priority': get_priority_from_risk_level(frm.doc.risk_level),
		'status': 'Open'
	});
}

function get_priority_from_risk_level(risk_level) {
	// Map risk level to priority
	switch(risk_level) {
		case 'Critical':
		case 'High':
			return 'High';
		case 'Medium':
			return 'Medium';
		case 'Low':
			return 'Low';
		default:
			return 'Medium';
	}
}

function suggest_safety_actions(frm) {
	// Call server method to get suggestions
	frappe.call({
		method: 'suggest_safety_actions',
		doc: frm.doc,
		callback: function(r) {
			if (r.message && r.message.length) {
				show_action_suggestions(frm, r.message);
			} else {
				frappe.msgprint(__('No safety action suggestions available'));
			}
		}
	});
}

function show_action_suggestions(frm, suggestions) {
	// Create a dialog to show suggestions
	let fields = [];
	
	// Add checkbox for each suggestion
	suggestions.forEach((suggestion, i) => {
		fields.push({
			label: suggestion.action,
			fieldname: 'action_' + i,
			fieldtype: 'Check',
			default: 1,
			description: __('Priority: {0}, Target: {1} days', 
				[suggestion.priority, suggestion.target_days])
		});
	});
	
	// Create the dialog
	let d = new frappe.ui.Dialog({
		title: __('Suggested Safety Actions'),
		fields: fields,
		primary_action_label: __('Create Selected Actions'),
		primary_action(values) {
			let selected_actions = [];
			
			// Get selected suggestions
			suggestions.forEach((suggestion, i) => {
				if (values['action_' + i]) {
					selected_actions.push(suggestion);
				}
			});
			
			// Create safety actions for selected suggestions
			if (selected_actions.length) {
				create_multiple_safety_actions(frm, selected_actions);
			}
			
			d.hide();
		}
	});
	
	d.show();
}

function create_multiple_safety_actions(frm, actions) {
	// Create multiple safety actions in sequence
	let created_count = 0;
	
	// Function to create a single action
	function create_action(index) {
		if (index >= actions.length) {
			// All actions created
			frappe.show_alert({
				message: __('Created {0} safety actions', [created_count]),
				indicator: 'green'
			});
			return;
		}
		
		let action = actions[index];
		let today = frappe.datetime.get_today();
		let target_date = frappe.datetime.add_days(today, action.target_days || 7);
		
		// Create the action
		frappe.db.insert({
			doctype: 'Construction Site Safety Action',
			action_description: action.action,
			priority: action.priority,
			status: 'Open',
			target_date: target_date
		}).then(doc => {
			created_count++;
			// Create next action
			create_action(index + 1);
		}).catch(err => {
			console.error(err);
			// Continue with next action even if this one failed
			create_action(index + 1);
		});
	}
	
	// Start creating actions
	create_action(0);
}