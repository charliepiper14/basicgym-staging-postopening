# Basic Icons form: sheet and email setup

This takes about 10 minutes. Do it logged in to the **BasicGym Google account**, so the sheet and the emails belong to BasicGym.

When it's set up, every application on basicgym.co.uk/basic-icons/:

- adds a row to the sheet, with the date, first name, mobile, email, handle, platform, followers, why, status, source and page;
- emails **info@basicgym.co.uk** with the subject `New Basic Icon application: [first name] ([handle])`. Reply-To is set to the applicant, so replying goes straight to them.

## Steps

1. **Create the sheet.** Google Drive > New > Google Sheets. Name it `Basic Icons applications`.
2. **Add the script.** In the sheet, go to Extensions > Apps Script.
   - Delete everything in `Code.gs`.
   - Paste in all of `basic-icons-form.gs`.
   - Rename the project `Basic Icons form` and click Save.
3. **Approve it once.**
   - In the function menu at the top, pick `setup`, then click Run.
   - Click Review permissions, pick the BasicGym account, then Advanced > Go to Basic Icons form > Allow.
   - This creates the `Applications` tab with headers, and allows the script to send email.
4. **Deploy it.**
   - Click Deploy > New deployment. Click the cog and choose Web app.
   - Description: `v1`
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click Deploy, then copy the **Web app URL**. It ends in `/exec`.
5. **Connect the page.** Paste the URL into `ICON_ENDPOINT` near the bottom of `elementor/08-basic-icons.html` (or send it to Charles).
6. **Test it.**
   - Submit one application on the live page with your own details.
   - Check that the row appears in the sheet.
   - Check that the email arrives in info@basicgym.co.uk. If it's in spam, mark it **Not spam** so the rest come through.

## Good to know

- **Changing the script later:** use Deploy > Manage deployments > edit > Version: New version. The URL stays the same.
- **Email limit:** about 100 emails a day on a standard Gmail account, and 1,500 on Google Workspace. That's plenty for applications.
- **Spam protection:** a hidden honeypot field and a minimum fill time on the page, plus checks on the email and phone format in the script.
- **Formulas:** values starting with `=`, `+` or `-` are stored as text, so nothing typed into the form can run as a formula in the sheet.
