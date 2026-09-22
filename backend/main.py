import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger("sourapple")

def send_order_alert(order: dict):
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").replace(" ", "").strip()
    admin_email = os.getenv("ADMIN_EMAIL", "natture1st@gmail.com").strip()

    if not smtp_user or not smtp_password:
        logger.error("EMAIL ERROR: SMTP_USER or SMTP_PASSWORD is not set in Render environment variables.")
        return False

    subject = f"New Laundry Order: {order.get('e_signature', 'VIP Customer')} - ${order.get('total_price')}"
    
    html = f"""
    <html>
      <body style="font-family: sans-serif; color: #1e293b; padding: 20px;">
        <h2 style="color: #16a34a;">New Laundry Order Received!</h2>
        <p><b>Customer:</b> {order.get('e_signature')}</p>
        <p><b>Bag Size:</b> {order.get('bag_size')}</p>
        <p><b>Total Price:</b> ${order.get('total_price')}</p>
        <p><b>MVCC Student/Faculty:</b> {order.get('is_mvcc')}</p>
        <p><b>Dorm / Location:</b> {order.get('dorm', 'South Utica')}</p>
        <p><b>Detergent:</b> {order.get('detergent_preference', 'Standard VIP Scented')}</p>
        <p><b>Water Temp:</b> {order.get('water_temperature', 'Cold')}</p>
        <p><b>Stains:</b> {order.get('stain_notes', 'None')}</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #64748b; font-size: 12px;">Sour Apple Wash & Fold VIP Laundry Services</p>
      </body>
    </html>
    """

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = smtp_user
        msg["To"] = admin_email
        msg["Subject"] = subject
        msg.attach(MIMEText(html, "html"))

        # Connect directly over SSL on port 465 (Bypasses Render firewall blocks)
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=15) as server:
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
            logger.info(f"SUCCESS: Alert email sent to {admin_email}")
            return True

    except smtplib.SMTPAuthenticationError as auth_err:
        logger.error(f"GMAIL AUTH ERROR: Google rejected the login. Check for spaces in SMTP_PASSWORD. Details: {auth_err}")
        return False
    except Exception as e:
        logger.error(f"FAILED TO SEND EMAIL: {e}")
        return False


# Diagnostic endpoint: Visit /api/admin/test-email in your browser to test live
@app.get("/api/admin/test-email")
async def test_email():
    test_order = {
        "e_signature": "LOreal Live Test",
        "bag_size": "Small",
        "total_price": 10.0,
        "is_mvcc": True,
        "dorm": "Bellamy Hall",
        "detergent_preference": "Standard VIP",
        "water_temperature": "Cold",
        "stain_notes": "Test stain"
    }
    sent = send_order_alert(test_order)
    if sent:
        return {"status": "SUCCESS: Test email delivered to natture1st@gmail.com"}
    else:
        return {"status": "FAILED: Check Render Logs for the exact Gmail error message"}
