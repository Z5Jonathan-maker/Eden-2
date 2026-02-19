import pytest

from services.evidence.scoring import score_email_relevance
from services.evidence.schemas import ClaimIdentityProfile


@pytest.fixture
def profile():
    return ClaimIdentityProfile(
        claim_id="claim-1",
        policyholder_names=["John Doe"],
        addresses=["123 Main St, Miami, FL"],
        policy_numbers=["POL-12345"],
        claim_numbers=["CLM-1001"],
        carrier_names=["carrier@example.com"],
        adjuster_emails=["adjuster@carrier.com"],
        subject_patterns=["Claim CLM-1001"],
    )


def test_relevance_scoring_hard_match_auto_ingest(profile):
    message = {
        "subject": "RE: CLM-1001 inspection update",
        "snippet": "Policy POL-12345 for 123 Main St",
        "headers": {
            "from": "adjuster@carrier.com",
            "to": "team@eden.com",
            "cc": "",
            "subject": "CLM-1001 status",
        },
        "body_text": "Insured John Doe at 123 Main St, Miami has requested update.",
        "body_html": "",
        "attachments": [{"filename": "CLM-1001-estimate.pdf"}],
    }

    score, reasons, breakdown = score_email_relevance(profile=profile, message=message)

    assert score >= 70
    assert breakdown["hard"] >= 40
    assert any("claim number" in reason for reason in reasons)


def test_relevance_scoring_soft_matches_review_queue(profile):
    message = {
        "subject": "Question on estimate",
        "snippet": "Following up",
        "headers": {
            "from": "person@carrierexample.com",
            "to": "adjuster@carrier.com",
            "cc": "",
            "subject": "Estimate question",
        },
        "body_text": "Looking for Doe file.",
        "body_html": "",
        "attachments": [{"filename": "doe_supporting_docs.zip"}],
    }

    score, reasons, breakdown = score_email_relevance(profile=profile, message=message)

    assert 0 <= score <= 100
    assert breakdown["soft"] >= 0
    assert isinstance(reasons, list)


def test_relevance_scoring_reject(profile):
    message = {
        "subject": "Completely unrelated newsletter",
        "snippet": "Marketing content",
        "headers": {
            "from": "news@example.org",
            "to": "random@example.org",
            "cc": "",
            "subject": "Weekly digest",
        },
        "body_text": "No claim context here.",
        "body_html": "",
        "attachments": [],
    }

    score, reasons, breakdown = score_email_relevance(profile=profile, message=message)

    assert score < 45
    assert breakdown["hard"] == 0
    assert isinstance(reasons, list)

