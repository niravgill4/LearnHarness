/**
 * Email validation utility to enforce valid, real, non-disposable email addresses.
 */

// Popular disposable, burner, and temporary email domains
const DISPOSABLE_DOMAINS = new Set([
	"10minutemail.com",
	"10minutemail.net",
	"burnermail.io",
	"dispostable.com",
	"emailondeck.com",
	"fakeinbox.com",
	"fakemailgenerator.com",
	"generator.email",
	"getairmail.com",
	"grr.la",
	"guerrillamail.biz",
	"guerrillamail.com",
	"guerrillamail.de",
	"guerrillamail.net",
	"guerrillamail.org",
	"guerrillamailblock.com",
	"inboxkitten.com",
	"mailinator.com",
	"mailinator2.com",
	"nada.ltd",
	"sharklasers.com",
	"temp-mail.org",
	"tempmail.com",
	"tempmail.net",
	"throwawaymail.com",
	"trashmail.com",
	"trashmail.net",
	"yopmail.com",
	"yopmail.fr",
	"yopmail.net",
]);

// Dummy test patterns to disallow
const DUMMY_PATTERNS = [
	/^test@test\./i,
	/^asdf@asdf\./i,
	/^admin@admin\./i,
	/^fake@fake\./i,
	/^user@user\./i,
	/^abc@abc\./i,
	/^sample@sample\./i,
	/^example@example\./i,
	/^a@a\./i,
	/^1@1\./i,
];

// RFC 5322 compliant regex with proper TLD requirement
const STRICT_EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export interface EmailValidationResult {
	valid: boolean;
	normalized: string;
	error?: string;
}

/**
 * Validates whether an email string is formatted correctly, uses a real TLD,
 * and is not a disposable or dummy mailbox.
 */
export function validateEmail(rawEmail: string): EmailValidationResult {
	const normalized = rawEmail.trim().toLowerCase();

	if (!normalized) {
		return { valid: false, normalized, error: "Please enter your email address." };
	}

	if (normalized.length > 254) {
		return { valid: false, normalized, error: "Email address is too long." };
	}

	if (!STRICT_EMAIL_REGEX.test(normalized)) {
		return { valid: false, normalized, error: "Please enter a valid email address (e.g., name@example.com)." };
	}

	const parts = normalized.split("@");
	if (parts.length !== 2 || !parts[0] || !parts[1]) {
		return { valid: false, normalized, error: "Please enter a valid email address." };
	}

	const localPart = parts[0];
	const domain = parts[1];

	if (localPart.length > 64) {
		return { valid: false, normalized, error: "Email username is too long." };
	}

	const domainParts = domain.split(".");
	const tld = domainParts[domainParts.length - 1];

	// TLD must be at least 2 characters and only letters
	if (!tld || tld.length < 2 || !/^[a-z]+$/.test(tld)) {
		return { valid: false, normalized, error: "Please enter a valid email domain." };
	}

	// Check against dummy patterns
	if (DUMMY_PATTERNS.some(pattern => pattern.test(normalized))) {
		return { valid: false, normalized, error: "Please enter a real, personal or work email address." };
	}

	// Check against known disposable domains
	if (DISPOSABLE_DOMAINS.has(domain)) {
		return {
			valid: false,
			normalized,
			error: "Temporary or disposable email addresses are not permitted. Please use a permanent email address.",
		};
	}

	return { valid: true, normalized };
}
