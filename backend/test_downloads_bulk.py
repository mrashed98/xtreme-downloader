"""Self-check for the bulk download action contract.

No framework on purpose -- this repo has no test deps. Run it directly:
    cd backend && python test_downloads_bulk.py
It also works under pytest if that ever gets added.
"""

from app.models.download import DownloadStatus, statuses_for_filter
from app.schemas.download import BulkActionRequest


def test_failed_filter_includes_cancelled():
    # The UI's Failed tab counts cancelled too; "retry all failed" must agree
    # with that count or it silently skips rows the user can see.
    got = statuses_for_filter("failed")
    assert DownloadStatus.failed in got, got
    assert DownloadStatus.cancelled in got, got


def test_other_filters_are_exact():
    assert statuses_for_filter("queued") == [DownloadStatus.queued]
    assert statuses_for_filter("paused") == [DownloadStatus.paused]


def test_unknown_status_rejected():
    try:
        statuses_for_filter("banana")
    except ValueError:
        return
    raise AssertionError("unknown status should raise ValueError")


def test_request_requires_known_action():
    BulkActionRequest(action="retry", status="failed")
    BulkActionRequest(action="delete", ids=[1, 2], delete_file=True)
    try:
        BulkActionRequest(action="explode", ids=[1])
    except Exception:
        return
    raise AssertionError("unknown action should be rejected")


def test_ids_and_status_both_optional_at_schema_level():
    # The endpoint enforces "one of" with a 400; the schema stays permissive so
    # the error message is ours rather than a pydantic wall of text.
    r = BulkActionRequest(action="pause")
    assert r.ids is None and r.status is None


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"  ok  {name}")
    print("all checks passed")
