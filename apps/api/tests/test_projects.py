from app.domains.projects.service import _normalize_path


def test_normalize_windows_workspace_path():
    assert _normalize_path(r"G:\Projects\Victorious Memory 2V\\") == "G:/Projects/Victorious Memory 2V"


def test_normalize_preserves_windows_drive_root():
    assert _normalize_path("C:/") == "C:/"


def test_normalize_resolves_dot_segments():
    assert _normalize_path("G:/Projects/./demo/../memory") == "G:/Projects/memory"
