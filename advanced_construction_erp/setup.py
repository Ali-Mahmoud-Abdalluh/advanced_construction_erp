import os

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields
from frappe.desk.page.setup_wizard.install_fixtures import (
	_,  # NOTE: this is not the real translation function
)
from frappe.desk.page.setup_wizard.setup_wizard import make_records
from frappe.installer import update_site_config


def after_install():
	create_custom_fields(get_custom_fields(), ignore_validate=True)
	# TODO (1): IN CASE OF NEED TO MAKE FIXTURES
	# this function for creating default data for the app, it will use the current doctypes inside this module to do so
	make_fixtures()
	# TODO (2): IN CASE OF NEED TO SETUP NOTIFICATIONS
	# this function used to send notifications to the users
	setup_notifications()
	# TODO (3): IN CASE OF NEED TO UPDATE HR DEFAULTS
	# it will be use for the default settings of the app data
	update_advanced_construction_erp_defaults()

	set_single_defaults()
	# TODO (6): IN CASE OF NEED TO CREATE DEFAULT ROLE PROFILES
	create_default_role_profiles()


def get_custom_fields():
	"""Advanced Construction ERP specific custom fields that need to be added to the masters in ERPNext"""
	return {
		"Company": [
			{
				"fieldname": "advanced_construction_erp_tap",
				"fieldtype": "Tab Break",
				"label": _("Advanced Construction ERP"),
				"insert_after": "hr_and_payroll_tab",
			},
			{
				"fieldname": "advanced_construction_erp_settings_section",
				"fieldtype": "Section Break",
				"label": _("Advanced Construction ERP Settings"),
				"insert_after": "advanced_construction_erp_tap",
			},
			{
				"depends_on": "eval:!doc.__islocal",
				"fieldname": "default_main_project_account",
				"fieldtype": "Link",
				"ignore_user_permissions": 1,
				"label": _("Default Main Project Payable Account"),
				"no_copy": 1,
				"options": "Account",
				"insert_after": "advanced_construction_erp_settings_section",
			},
			{
				"fieldname": "column_break_10",
				"fieldtype": "Column Break",
				"insert_after": "default_main_project_account",
			},
		],
		"Department": [
			{
				"fieldname": "section_break_5",
				"fieldtype": "Section Break",
				"insert_after": "leave_approvers",
			},
			{
				"fieldname": "projects_cost_center",
				"fieldtype": "Link",
				"label": _("Projects Cost Center"),
				"options": "Cost Center",
				"insert_after": "section_break_5",
			},
			{
				"fieldname": "column_break_11",
				"fieldtype": "Column Break",
				"insert_after": "projects_cost_center",
			},
		],
	}


def make_fixtures():
	pass
	# records = [
	# 	# expense claim type
	# 	{"doctype": "Expense Claim Type", "name": _("Calls"), "expense_type": _("Calls")},
	# 	{"doctype": "Expense Claim Type", "name": _("Food"), "expense_type": _("Food")},
	# 	{"doctype": "Expense Claim Type", "name": _("Medical"), "expense_type": _("Medical")},
	# 	{"doctype": "Expense Claim Type", "name": _("Others"), "expense_type": _("Others")},
	# 	{"doctype": "Expense Claim Type", "name": _("Travel"), "expense_type": _("Travel")},
	# 	# vehicle service item
	# 	{"doctype": "Vehicle Service Item", "service_item": "Brake Oil"},
	# 	{"doctype": "Vehicle Service Item", "service_item": "Brake Pad"},
	# 	{"doctype": "Vehicle Service Item", "service_item": "Clutch Plate"},
	# 	{"doctype": "Vehicle Service Item", "service_item": "Engine Oil"},
	# 	{"doctype": "Vehicle Service Item", "service_item": "Oil Change"},
	# 	{"doctype": "Vehicle Service Item", "service_item": "Wheels"},
	# 	# leave type
	# 	{
	# 		"doctype": "Leave Type",
	# 		"leave_type_name": _("Casual Leave"),
	# 		"name": _("Casual Leave"),
	# 		"allow_encashment": 1,
	# 		"is_carry_forward": 1,
	# 		"max_continuous_days_allowed": "3",
	# 		"include_holiday": 1,
	# 	},
	# 	{
	# 		"doctype": "Leave Type",
	# 		"leave_type_name": _("Compensatory Off"),
	# 		"name": _("Compensatory Off"),
	# 		"allow_encashment": 0,
	# 		"is_carry_forward": 0,
	# 		"include_holiday": 1,
	# 		"is_compensatory": 1,
	# 	},
	# 	{
	# 		"doctype": "Leave Type",
	# 		"leave_type_name": _("Sick Leave"),
	# 		"name": _("Sick Leave"),
	# 		"allow_encashment": 0,
	# 		"is_carry_forward": 0,
	# 		"include_holiday": 1,
	# 	},
	# 	{
	# 		"doctype": "Leave Type",
	# 		"leave_type_name": _("Privilege Leave"),
	# 		"name": _("Privilege Leave"),
	# 		"allow_encashment": 0,
	# 		"is_carry_forward": 0,
	# 		"include_holiday": 1,
	# 	},
	# 	{
	# 		"doctype": "Leave Type",
	# 		"leave_type_name": _("Leave Without Pay"),
	# 		"name": _("Leave Without Pay"),
	# 		"allow_encashment": 0,
	# 		"is_carry_forward": 0,
	# 		"is_lwp": 1,
	# 		"include_holiday": 1,
	# 	},
	# 	# Employment Type
	# 	{"doctype": "Employment Type", "employee_type_name": _("Full-time")},
	# 	{"doctype": "Employment Type", "employee_type_name": _("Part-time")},
	# 	{"doctype": "Employment Type", "employee_type_name": _("Probation")},
	# 	{"doctype": "Employment Type", "employee_type_name": _("Contract")},
	# 	{"doctype": "Employment Type", "employee_type_name": _("Commission")},
	# 	{"doctype": "Employment Type", "employee_type_name": _("Piecework")},
	# 	{"doctype": "Employment Type", "employee_type_name": _("Intern")},
	# 	{"doctype": "Employment Type", "employee_type_name": _("Apprentice")},
	# 	# Job Applicant Source
	# 	{"doctype": "Job Applicant Source", "source_name": _("Website Listing")},
	# 	{"doctype": "Job Applicant Source", "source_name": _("Walk In")},
	# 	{"doctype": "Job Applicant Source", "source_name": _("Employee Referral")},
	# 	{"doctype": "Job Applicant Source", "source_name": _("Campaign")},
	# 	# Offer Term
	# 	{"doctype": "Offer Term", "offer_term": _("Date of Joining")},
	# 	{"doctype": "Offer Term", "offer_term": _("Annual Salary")},
	# 	{"doctype": "Offer Term", "offer_term": _("Probationary Period")},
	# 	{"doctype": "Offer Term", "offer_term": _("Employee Benefits")},
	# 	{"doctype": "Offer Term", "offer_term": _("Working Hours")},
	# 	{"doctype": "Offer Term", "offer_term": _("Stock Options")},
	# 	{"doctype": "Offer Term", "offer_term": _("Department")},
	# 	{"doctype": "Offer Term", "offer_term": _("Job Description")},
	# 	{"doctype": "Offer Term", "offer_term": _("Responsibilities")},
	# 	{"doctype": "Offer Term", "offer_term": _("Leaves per Year")},
	# 	{"doctype": "Offer Term", "offer_term": _("Notice Period")},
	# 	{"doctype": "Offer Term", "offer_term": _("Incentives")},
	# 	# Email Account
	# 	{"doctype": "Email Account", "email_id": "jobs@example.com", "append_to": "Job Applicant"},
	# ]

	# make_records(records)


def setup_notifications():
	pass
	# base_path = frappe.get_app_path("advanced_construction_erp", "advanced_construction", "doctype")

	# # Leave Application
	# response = frappe.read_file(
	# 	os.path.join(base_path, "leave_application/leave_application_email_template.html")
	# )
	# records = [
	# 	{
	# 		"doctype": "Email Template",
	# 		"name": _("Leave Approval Notification"),
	# 		"response": response,
	# 		"subject": _("Leave Approval Notification"),
	# 		"owner": frappe.session.user,
	# 	}
	# ]
	# records += [
	# 	{
	# 		"doctype": "Email Template",
	# 		"name": _("Leave Status Notification"),
	# 		"response": response,
	# 		"subject": _("Leave Status Notification"),
	# 		"owner": frappe.session.user,
	# 	}
	# ]

	# # Interview
	# response = frappe.read_file(
	# 	os.path.join(base_path, "interview/interview_reminder_notification_template.html")
	# )
	# records += [
	# 	{
	# 		"doctype": "Email Template",
	# 		"name": _("Interview Reminder"),
	# 		"response": response,
	# 		"subject": _("Interview Reminder"),
	# 		"owner": frappe.session.user,
	# 	}
	# ]
	# response = frappe.read_file(
	# 	os.path.join(base_path, "interview/interview_feedback_reminder_template.html")
	# )
	# records += [
	# 	{
	# 		"doctype": "Email Template",
	# 		"name": _("Interview Feedback Reminder"),
	# 		"response": response,
	# 		"subject": _("Interview Feedback Reminder"),
	# 		"owner": frappe.session.user,
	# 	}
	# ]

	# # Exit Interview
	# response = frappe.read_file(
	# 	os.path.join(base_path, "exit_interview/exit_questionnaire_notification_template.html")
	# )
	# records += [
	# 	{
	# 		"doctype": "Email Template",
	# 		"name": _("Exit Questionnaire Notification"),
	# 		"response": response,
	# 		"subject": _("Exit Questionnaire Notification"),
	# 		"owner": frappe.session.user,
	# 	}
	# ]

	# make_records(records)


def update_advanced_construction_erp_defaults():
	pass
	# hr_settings = frappe.get_doc("HR Settings")
	# hr_settings.emp_created_by = "Naming Series"
	# hr_settings.leave_approval_notification_template = _("Leave Approval Notification")
	# hr_settings.leave_status_notification_template = _("Leave Status Notification")

	# hr_settings.send_interview_reminder = 1
	# hr_settings.interview_reminder_template = _("Interview Reminder")
	# hr_settings.remind_before = "00:15:00"

	# hr_settings.send_interview_feedback_reminder = 1
	# hr_settings.feedback_reminder_notification_template = _("Interview Feedback Reminder")

	# hr_settings.exit_questionnaire_notification_template = _("Exit Questionnaire Notification")
	# hr_settings.save()

def set_single_defaults():
	for dt in ("Advanced Construction ERP Settings"):
		default_values = frappe.get_all(
			"DocField",
			filters={"parent": dt},
			fields=["fieldname", "default"],
			as_list=True,
		)
		if default_values:
			try:
				doc = frappe.get_doc(dt, dt)
				for fieldname, value in default_values:
					doc.set(fieldname, value)
				doc.flags.ignore_mandatory = True
				doc.save()
			except frappe.ValidationError:
				pass


def create_default_role_profiles():
	for role_profile_name, roles in DEFAULT_ROLE_PROFILES.items():
		if frappe.db.exists("Role Profile", role_profile_name):
			continue

		role_profile = frappe.new_doc("Role Profile")
		role_profile.role_profile = role_profile_name
		for role in roles:
			role_profile.append("roles", {"role": role})

		role_profile.insert(ignore_permissions=True)


def update_user_type_doctype_limit(user_types=None):
	if not user_types:
		user_types = get_user_types_data()

	user_type_limit = {}
	for user_type, __ in user_types.items():
		user_type_limit.setdefault(frappe.scrub(user_type), 40)

	update_site_config("user_type_doctype_limit", user_type_limit)


def get_user_types_data():
    pass
    # used to give the roles permision for each doctype need to for the created roles
	# return {
	# 	"Advanced Construction ERP": {
	# 		"role": "Construction Manager",
	# 		"apply_user_permission_on": "Construction Manager",
	# 		"user_id_field": "user_id",
	# 		"doctypes": {
	# 			# masters
	# 			"Project": ["read", "write"],
	# 			"Project Task": ["read", "write"],
	# 			"Project Task Type": ["read"],
	# 			"Project Task Type": ["read"],
	# 			# leave and attendance
	# 			"Leave Application": ["read", "write", "create", "delete"],
	# 			"Attendance Request": ["read", "write", "create", "delete"],
	# 			"Compensatory Leave Request": ["read", "write", "create", "delete"],
	# 			# tax
	# 			"Employee Tax Exemption Declaration": ["read", "write", "create", "delete"],
	# 			"Employee Tax Exemption Proof Submission": ["read", "write", "create", "delete"],
	# 			# projects
	# 			"Timesheet": ["read", "write", "create", "delete", "submit", "cancel", "amend"],
	# 			# trainings
	# 			"Training Program": ["read"],
	# 			"Training Feedback": ["read", "write", "create", "delete", "submit", "cancel", "amend"],
	# 			# shifts
	# 			"Employee Checkin": ["read"],
	# 			"Shift Request": ["read", "write", "create", "delete", "submit", "cancel", "amend"],
	# 			# misc
	# 			"Employee Grievance": ["read", "write", "create", "delete"],
	# 			"Employee Referral": ["read", "write", "create", "delete"],
	# 			"Travel Request": ["read", "write", "create", "delete"],
	# 		},
	# 	}
	# }




def create_custom_role(data):
	if data.get("role") and not frappe.db.exists("Role", data.get("role")):
		frappe.get_doc(
			{"doctype": "Role", "role_name": data.get("role"), "desk_access": 1, "is_custom": 1}
		).insert(ignore_permissions=True)


def append_docperms_to_user_type(docperms, doc):
	existing_doctypes = [d.document_type for d in doc.user_doctypes]

	for doctype, perms in docperms.items():
		if doctype in existing_doctypes:
			continue

		args = {"document_type": doctype}
		for perm in perms:
			args[perm] = 1

		doc.append("user_doctypes", args)


def update_select_perm_after_install():
	if not frappe.flags.update_select_perm_after_migrate:
		return

	frappe.flags.ignore_select_perm = False
	for row in frappe.get_all("User Type", filters={"is_standard": 0}):
		print("Updating user type :- ", row.name)
		doc = frappe.get_doc("User Type", row.name)
		doc.flags.ignore_links = True
		doc.save()

	frappe.flags.update_select_perm_after_migrate = False



DEFAULT_ROLE_PROFILES = {
	"Advanced Construction ERP": [
		"Construction User",
		"Construction Manager"
	],
}
