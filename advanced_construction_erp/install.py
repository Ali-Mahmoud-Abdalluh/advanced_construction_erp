import click

from advanced_construction_erp.setup import after_install as setup


def after_install():
	try:
		print("Setting up Advanced Construction ERP...")
		setup()

		click.secho("Thank you for installing Advanced Construction ERP!", fg="green")

	except Exception as e:
		BUG_REPORT_URL = "https://github.com/Ali-Mahmoud-Abdalluh/advanced_construction_erp/issues/new"
		click.secho(
			"Installation for Advanced Construction ERP app failed due to an error."
			" Please try re-installing the app or"
			f" report the issue on {BUG_REPORT_URL} if not resolved.",
			fg="bright_red",
		)
		raise e
