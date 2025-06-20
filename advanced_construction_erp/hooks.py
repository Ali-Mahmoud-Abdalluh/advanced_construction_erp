app_name = "advanced_construction_erp"
app_title = "Advanced Construction ERP"
app_publisher = "Ali Mahmoud Abdalluh"
app_description = "Free Opensource Advanced Construction ERP Software"
app_email = "alimahmoudabdallaemam12@gmail.com"
app_license = "GNU General Public License (v3)"
required_apps = ["frappe/erpnext", "frappe/advanced_construction_erp"]
source_link = "http://github.com/Ali-Mahmoud-Abdalluh/advanced_construction_erp"
app_logo_url = "/assets/advanced_construction_erp/images/advanced_construction_erp-logo.svg"
app_home = "/app/overview"

add_to_apps_screen = [
	{
		"name": "advanced_construction_erp",
		"logo": "/assets/advanced_construction_erp/images/advanced_construction_erp-logo.svg",
		"title": "Advanced Construction ERP",
		"route": "/app/overview",
		"has_permission": "advanced_construction_erp.advanced_construction.utils.check_app_permission",
	}
]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/advanced_construction_erp/css/advanced_construction_erp.css"
app_include_js = [
	"advanced_construction_erp.bundle.js",
]
app_include_css = "advanced_construction_erp.bundle.css"

# website

# include js, css files in header of web template
# web_include_css = "/assets/advanced_construction_erp/css/advanced_construction_erp.css"
# web_include_js = "/assets/advanced_construction_erp/js/advanced_construction_erp.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "advanced_construction_erp/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
doctype_js = {
	"Employee": "public/js/erpnext/employee.js",
	"Company": "public/js/erpnext/company.js",
	"Department": "public/js/erpnext/department.js",
	"Timesheet": "public/js/erpnext/timesheet.js",
	"Payment Entry": "public/js/erpnext/payment_entry.js",
	"Journal Entry": "public/js/erpnext/journal_entry.js",
	"Delivery Trip": "public/js/erpnext/delivery_trip.js",
	"Bank Transaction": "public/js/erpnext/bank_transaction.js",
}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }


# TODO(1): add calendars like this
# calendars = ["Leave Application"]

# Generators
# ----------

# automatically create page for each record of this doctype
# TODO(2): add website_generators like this if needed
#website_generators = ["Job Opening"]

website_route_rules = [
	{"from_route": "/advanced_construction_erp/<path:app_path>", "to_route": "advanced_construction_erp"},
	{"from_route": "/advanced_construction/<path:app_path>", "to_route": "roster"},
]
# Jinja
# ----------

# add methods and filters to jinja environment
jinja = {
	"methods": [
		"advanced_construction_erp.utils.get_country",
	],
}

# Installation
# ------------

# before_install = "advanced_construction_erp.install.before_install"
after_install = "advanced_construction_erp.install.after_install"
after_migrate = "advanced_construction_erp.setup.update_select_perm_after_install"

setup_wizard_complete = "advanced_construction_erp.subscription_utils.update_erpnext_access"

# Uninstallation
# ------------

before_uninstall = "advanced_construction_erp.uninstall.before_uninstall"
# after_uninstall = "advanced_construction_erp.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "advanced_construction_erp.utils.before_app_install"
after_app_install = "advanced_construction_erp.setup.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

before_app_uninstall = "advanced_construction_erp.setup.before_app_uninstall"
# after_app_uninstall = "advanced_construction_erp.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "advanced_construction_erp.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }


#TODO (Note): will keep it for now
has_upload_permission = {"Employee": "erpnext.setup.doctype.employee.employee.has_upload_permission"}

# DocType Class
# ---------------
# Override standard doctype classes


# TODO (3): IN CASE OF NEED TO OVERRIDE DOCTYPE CLASS
# override_doctype_class = {
# 	"Employee": "advanced_construction_erp.overrides.employee_master.EmployeeMaster",
# 	"Timesheet": "advanced_construction_erp.overrides.employee_timesheet.EmployeeTimesheet",
# 	"Payment Entry": "advanced_construction_erp.overrides.employee_payment_entry.EmployeePaymentEntry",
# 	"Project": "advanced_construction_erp.overrides.employee_project.EmployeeProject",
# }

# Document Events
# ---------------
# Hook on document methods and events

# TODO (4): IN CASE OF NEED TO OVERRIDE DOCUMENT EVENTS
# doc_events = {
# 	"User": {
# 		"validate": "erpnext.setup.doctype.employee.employee.validate_employee_role",
# 	},
# 	"Company": {
# 		"validate": "advanced_construction_erp.overrides.company.validate_default_accounts",
# 		"on_update": [
# 			"advanced_construction_erp.overrides.company.make_company_fixtures",
# 			"advanced_construction_erp.overrides.company.set_default_hr_accounts",
# 		],
# 		"on_trash": "advanced_construction_erp.overrides.company.handle_linked_docs",
# 	},
# 	"Holiday List": {
# 		"on_update": "advanced_construction_erp.utils.holiday_list.invalidate_cache",
# 		"on_trash": "advanced_construction_erp.utils.holiday_list.invalidate_cache",
# 	},
# 	"Timesheet": {"validate": "advanced_construction_erp.advanced_construction.utils.validate_active_employee"},
# 	"Payment Entry": {
# 		"on_submit": "advanced_construction_erp.advanced_construction.doctype.expense_claim.expense_claim.update_payment_for_expense_claim",
# 		"on_cancel": "advanced_construction_erp.advanced_construction.doctype.expense_claim.expense_claim.update_payment_for_expense_claim",
# 		"on_update_after_submit": "advanced_construction_erp.advanced_construction.doctype.expense_claim.expense_claim.update_payment_for_expense_claim",
# 	},
# 	"Journal Entry": {
# 		"validate": "advanced_construction_erp.advanced_construction.doctype.expense_claim.expense_claim.validate_expense_claim_in_jv",
# 		"on_submit": [
# 			"advanced_construction_erp.advanced_construction.doctype.expense_claim.expense_claim.update_payment_for_expense_claim",
# 			"advanced_construction_erp.advanced_construction.doctype.full_and_final_statement.full_and_final_statement.update_full_and_final_statement_status",
# 			"advanced_construction_erp.payroll.doctype.salary_withholding.salary_withholding.update_salary_withholding_payment_status",
# 		],
# 		"on_update_after_submit": "advanced_construction_erp.advanced_construction.doctype.expense_claim.expense_claim.update_payment_for_expense_claim",
# 		"on_cancel": [
# 			"advanced_construction_erp.advanced_construction.doctype.expense_claim.expense_claim.update_payment_for_expense_claim",
# 			"advanced_construction_erp.payroll.doctype.salary_slip.salary_slip.unlink_ref_doc_from_salary_slip",
# 			"advanced_construction_erp.advanced_construction.doctype.full_and_final_statement.full_and_final_statement.update_full_and_final_statement_status",
# 			"advanced_construction_erp.payroll.doctype.salary_withholding.salary_withholding.update_salary_withholding_payment_status",
# 		],
# 	},
# 	"Loan": {"validate": "advanced_construction_erp.advanced_construction.utils.validate_loan_repay_from_salary"},
# 	"Employee": {
# 		"validate": "advanced_construction_erp.overrides.employee_master.validate_onboarding_process",
# 		"on_update": [
# 			"advanced_construction_erp.overrides.employee_master.update_approver_role",
# 			"advanced_construction_erp.overrides.employee_master.publish_update",
# 		],
# 		"after_insert": "advanced_construction_erp.overrides.employee_master.update_job_applicant_and_offer",
# 		"on_trash": "advanced_construction_erp.overrides.employee_master.update_employee_transfer",
# 		"after_delete": "advanced_construction_erp.overrides.employee_master.publish_update",
# 	},
# 	"Project": {"validate": "advanced_construction_erp.controllers.employee_boarding_controller.update_employee_boarding_status"},
# 	"Task": {"on_update": "advanced_construction_erp.controllers.employee_boarding_controller.update_task"},
# }

# Scheduled Tasks
# ---------------

# TODO (5): IN CASE OF NEED TO OVERRIDE SCHEDULED TASKS
# scheduler_events = {
# 	"all": [
# 		"advanced_construction_erp.advanced_construction.doctype.interview.interview.send_interview_reminder",
# 	],
# 	"hourly": [
# 		"advanced_construction_erp.advanced_construction.doctype.daily_work_summary_group.daily_work_summary_group.trigger_emails",
# 	],
# 	"hourly_long": [
# 		"advanced_construction_erp.advanced_construction.doctype.shift_type.shift_type.update_last_sync_of_checkin",
# 		"advanced_construction_erp.advanced_construction.doctype.shift_type.shift_type.process_auto_attendance_for_all_shifts",
# 		"advanced_construction_erp.advanced_construction.doctype.shift_schedule_assignment.shift_schedule_assignment.process_auto_shift_creation",
# 	],
# 	"daily": [
# 		"advanced_construction_erp.controllers.employee_reminders.send_birthday_reminders",
# 		"advanced_construction_erp.controllers.employee_reminders.send_work_anniversary_reminders",
# 		"advanced_construction_erp.advanced_construction.doctype.daily_work_summary_group.daily_work_summary_group.send_summary",
# 		"advanced_construction_erp.advanced_construction.doctype.interview.interview.send_daily_feedback_reminder",
# 		"advanced_construction_erp.advanced_construction.doctype.job_opening.job_opening.close_expired_job_openings",
# 	],
# 	"daily_long": [
# 		"advanced_construction_erp.advanced_construction.doctype.leave_ledger_entry.leave_ledger_entry.process_expired_allocation",
# 		"advanced_construction_erp.advanced_construction.utils.generate_leave_encashment",
# 		"advanced_construction_erp.advanced_construction.utils.allocate_earned_leaves",
# 	],
# 	"weekly": ["advanced_construction_erp.controllers.employee_reminders.send_reminders_in_advance_weekly"],
# 	"monthly": ["advanced_construction_erp.controllers.employee_reminders.send_reminders_in_advance_monthly"],
# }

# TODO (6): IN CASE OF NEED TO OVERRIDE ADVANCE PAYMENT PAYABLE DOCTYPES
#advance_payment_payable_doctypes = ["Leave Encashment", "Gratuity", "Employee Advance"]

# TODO (7): IN CASE OF NEED TO OVERRIDE INVOICE DOCTYPES
#invoice_doctypes = ["Expense Claim"]

# TODO (8): IN CASE OF NEED TO OVERRIDE PERIOD CLOSING DOCTYPES
#period_closing_doctypes = ["Payroll Entry"]

# TODO (9): IN CASE OF NEED TO OVERRIDE ACCOUNTING DIMENSION DOCTYPES
#accounting_dimension_doctypes = [
#	"Expense Claim",
#	"Expense Claim Detail",
#	"Expense Taxes and Charges",
#	"Payroll Entry",
#	"Leave Encashment",
#]

# TODO (10): IN CASE OF NEED TO OVERRIDE BANK RECONCILIATION DOCTYPES
#bank_reconciliation_doctypes = ["Expense Claim"]

# Testing
# -------

# TODO (11): IN CASE OF NEED TO OVERRIDE TESTS
#before_tests = "advanced_construction_erp.tests.test_utils.before_tests"

# Overriding Methods
# -----------------------------

# get matching queries for Bank Reconciliation
# TODO (12): IN CASE OF NEED TO OVERRIDE GET MATCHING QUERIES
#get_matching_queries = "advanced_construction_erp.advanced_construction.utils.get_matching_queries"

# TODO (13): IN CASE OF NEED TO OVERRIDE REGIONAL OVERRIDES
# regional_overrides = {
# 	"India": {
# 		"advanced_construction_erp.advanced_construction.utils.calculate_annual_eligible_hra_exemption": "advanced_construction_erp.regional.india.utils.calculate_annual_eligible_hra_exemption",
# 		"advanced_construction_erp.advanced_construction.utils.calculate_hra_exemption_for_period": "advanced_construction_erp.regional.india.utils.calculate_hra_exemption_for_period",
# 		"advanced_construction_erp.advanced_construction.utils.calculate_tax_with_marginal_relief": "advanced_construction_erp.regional.india.utils.calculate_tax_with_marginal_relief",
# 	},
# }

# ERPNext doctypes for Global Search
# TODO (14): IN CASE OF NEED TO OVERRIDE GLOBAL SEARCH DOCTYPES
# global_search_doctypes = {
# 	"Default": [
# 		{"doctype": "Salary Slip", "index": 19},
# 		{"doctype": "Leave Application", "index": 20},
# 		{"doctype": "Expense Claim", "index": 21},
# 		{"doctype": "Employee Grade", "index": 37},
# 		{"doctype": "Job Opening", "index": 39},
# 		{"doctype": "Job Applicant", "index": 40},
# 		{"doctype": "Job Offer", "index": 41},
# 		{"doctype": "Salary Structure Assignment", "index": 42},
# 		{"doctype": "Appraisal", "index": 43},
# 	],
# }

# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "advanced_construction_erp.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps

# TODO (15): IN CASE OF NEED TO OVERRIDE DOCTYPE DASHBOARDS
# override_doctype_dashboards = {
# 	"Employee": "advanced_construction_erp.overrides.dashboard_overrides.get_dashboard_for_employee",
# 	"Holiday List": "advanced_construction_erp.overrides.dashboard_overrides.get_dashboard_for_holiday_list",
# 	"Task": "advanced_construction_erp.overrides.dashboard_overrides.get_dashboard_for_project",
# 	"Project": "advanced_construction_erp.overrides.dashboard_overrides.get_dashboard_for_project",
# 	"Timesheet": "advanced_construction_erp.overrides.dashboard_overrides.get_dashboard_for_timesheet",
# 	"Bank Account": "advanced_construction_erp.overrides.dashboard_overrides.get_dashboard_for_bank_account",
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# TODO (16): IN CASE OF NEED TO IGNORE LINKS ON DELETE
#ignore_links_on_delete = ["PWA Notification"]

# User Data Protection
# --------------------


# Translation
# --------------------------------

# Make link fields search translated document names for these DocTypes
# Recommended only for DocTypes which have limited documents with untranslated names
# For example: Role, Gender, etc.
# translated_search_doctypes = []

# TODO (17): IN CASE OF NEED TO IGNORE COMPANY DATA
#company_data_to_be_ignored = [
#	"Salary Component Account",
#	"Salary Structure",
#	"Salary Structure Assignment",
#	"Payroll Period",
#	"Income Tax Slab",
#	"Leave Period",
#	"Leave Policy Assignment",
#	"Employee Onboarding Template",
#	"Employee Separation Template",
#]
