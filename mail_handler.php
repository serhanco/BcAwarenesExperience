<?php
/**
 * Symphony of Touch — Mail Handler
 * Acıbadem International · Breast Cancer Awareness Month
 *
 * Receives form POST, validates, and sends email.
 * Upload to the same directory as index.html on shared hosting.
 *
 * Requirements: PHP 7+ with mail() function (available on all shared hosting)
 * Optional: Replace mail() with PHPMailer for SMTP (more reliable)
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// ─── Config ────────────────────────────────────────────────────
$TO_EMAIL    = 'YOUR_EMAIL@acibadem.com'; // ← Replace with real destination
$FROM_EMAIL  = 'noreply@yourdomain.com';  // ← Replace with your domain
$FROM_NAME   = 'Acıbadem Awareness Campaign';
$SUBJECT     = '[Breast Health Inquiry] New Lead from Symphony of Touch';

// ─── Honeypot check ────────────────────────────────────────────
if (!empty($_POST['e_mail'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Bot detected']);
    exit;
}

// ─── Method guard ──────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// ─── Sanitize inputs ───────────────────────────────────────────
function clean(string $val): string {
    return htmlspecialchars(strip_tags(trim($val)), ENT_QUOTES, 'UTF-8');
}

$firstName  = clean($_POST['firstName']  ?? '');
$lastName   = clean($_POST['lastName']   ?? '');
$email      = filter_var(trim($_POST['email'] ?? ''), FILTER_SANITIZE_EMAIL);
$phone      = clean($_POST['phone']      ?? '');
$country    = clean($_POST['country']    ?? '');
$quizScore  = intval($_POST['quizScore'] ?? -1);
$pageUrl    = clean($_POST['pageUrl']    ?? '');

// ─── Validate required fields ──────────────────────────────────
if (empty($firstName) || empty($lastName) || !filter_var($email, FILTER_VALIDATE_EMAIL) || empty($phone) || empty($country)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'error' => 'Please fill in all required fields.']);
    exit;
}

// ─── Quiz score label ──────────────────────────────────────────
$quizLabels = [
    0 => 'Low urgency (0 yes answers)',
    1 => 'Moderate (1 yes answer)',
    2 => 'High (2 yes answers)',
    3 => 'Urgent (3 yes answers)',
];
$quizLabel = $quizLabels[$quizScore] ?? 'Not completed';

// ─── Build email body ──────────────────────────────────────────
$date    = date('Y-m-d H:i:s T');
$ip      = $_SERVER['REMOTE_ADDR'] ?? 'Unknown';
$body    = "New inquiry from the 'Symphony of Touch' Breast Health Awareness Campaign\n";
$body   .= str_repeat('-', 60) . "\n\n";
$body   .= "Name:        {$firstName} {$lastName}\n";
$body   .= "Email:       {$email}\n";
$body   .= "Phone:       {$phone}\n";
$body   .= "Country:     {$country}\n\n";
$body   .= "Quiz Score:  {$quizLabel}\n\n";
$body   .= str_repeat('-', 60) . "\n";
$body   .= "Submitted:   {$date}\n";
$body   .= "IP Address:  {$ip}\n";
$body   .= "Source URL:  {$pageUrl}\n";

// ─── Headers ───────────────────────────────────────────────────
$headers  = "From: {$FROM_NAME} <{$FROM_EMAIL}>\r\n";
$headers .= "Reply-To: {$email}\r\n";
$headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

// ─── Send ──────────────────────────────────────────────────────
$sent = mail($TO_EMAIL, $SUBJECT, $body, $headers);

if ($sent) {
    http_response_code(200);
    echo json_encode(['success' => true, 'message' => 'Thank you. We will be in touch shortly.']);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Mailer error. Please try again or contact us directly.']);
}
