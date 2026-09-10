use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    path::{Path, PathBuf},
};
use tauri::Manager;

const SUBSCRIPTIONS_FILE: &str = "station-subscriptions.json";

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct StationSubscription {
    station_id: String,
    station_name: String,
}

#[tauri::command]
fn list_station_subscriptions(app: tauri::AppHandle) -> Result<Vec<StationSubscription>, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join(SUBSCRIPTIONS_FILE);
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = std::fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&content).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_station_subscriptions(
    app: tauri::AppHandle,
    subscriptions: Vec<StationSubscription>,
) -> Result<(), String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let content = serde_json::to_vec_pretty(&subscriptions).map_err(|error| error.to_string())?;
    std::fs::write(directory.join(SUBSCRIPTIONS_FILE), content).map_err(|error| error.to_string())
}

#[tauri::command]
async fn save_cached_track(
    app: tauri::AppHandle,
    download_url: String,
    station_name: String,
    file_name: String,
    cached_track_id: String,
) -> Result<bool, String> {
    let station_directory = app
        .path()
        .audio_dir()
        .map_err(|error| error.to_string())?
        .join("Music Library")
        .join(sanitize_file_name(&station_name, "Station"));
    std::fs::create_dir_all(&station_directory).map_err(|error| error.to_string())?;

    let id_token = cached_track_id.replace('-', "");
    if directory_contains_track(&station_directory, &id_token)? {
        return Ok(false);
    }

    let response = reqwest::get(download_url)
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?;
    let content = response.bytes().await.map_err(|error| error.to_string())?;
    let requested_name = Path::new(&file_name)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("radio-track.mp3");
    let stem = Path::new(requested_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("radio-track");
    let extension = Path::new(requested_name)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("mp3");
    let destination = station_directory.join(format!(
        "{} [{}].{}",
        sanitize_file_name(stem, "radio-track"),
        id_token,
        sanitize_file_name(extension, "mp3")
    ));
    std::fs::write(destination, content).map_err(|error| error.to_string())?;
    Ok(true)
}

fn directory_contains_track(directory: &Path, id_token: &str) -> Result<bool, String> {
    for entry in std::fs::read_dir(directory).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if entry
            .file_name()
            .to_string_lossy()
            .to_lowercase()
            .contains(&id_token.to_lowercase())
        {
            return Ok(true);
        }
    }
    Ok(false)
}

fn offline_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .audio_dir()
        .map_err(|error| error.to_string())?
        .join("Music Library");
    std::fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    Ok(root)
}

fn collect_offline_tracks(
    directory: &Path,
    root: &Path,
    tracks: &mut Vec<DesktopOfflineTrack>,
) -> Result<(), String> {
    for entry in std::fs::read_dir(directory).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            collect_offline_tracks(&path, root, tracks)?;
        } else {
            tracks.push(offline_track(&path, root)?);
        }
    }
    Ok(())
}

fn offline_track(path: &Path, root: &Path) -> Result<DesktopOfflineTrack, String> {
    let metadata = std::fs::metadata(path).map_err(|error| error.to_string())?;
    let modified = metadata
        .modified()
        .map_err(|error| error.to_string())?
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| error.to_string())?;
    let saved_at = format!("{:020}", modified.as_millis());
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("radio-track.mp3")
        .to_string();
    let station_name = path
        .parent()
        .and_then(|parent| parent.strip_prefix(root).ok())
        .and_then(|relative| relative.components().next())
        .map(|component| component.as_os_str().to_string_lossy().into_owned());
    Ok(DesktopOfflineTrack {
        key: path.to_string_lossy().into_owned(),
        name,
        size: metadata.len(),
        saved_at,
        station_name,
        content_type: content_type(path).to_string(),
    })
}

fn content_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_lowercase)
        .as_deref()
    {
        Some("aac") => "audio/aac",
        Some("flac") => "audio/flac",
        Some("ogg") => "audio/ogg",
        _ => "audio/mpeg",
    }
}

fn validated_offline_path(app: &tauri::AppHandle, key: &str) -> Result<PathBuf, String> {
    let root = offline_root(app)?
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let path = PathBuf::from(key)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    if !path.starts_with(root) || !path.is_file() {
        return Err("Cached track path is outside the Music Library folder".to_string());
    }
    Ok(path)
}

fn available_destination(directory: &Path, file_name: &str) -> PathBuf {
    let requested = directory.join(file_name);
    if !requested.exists() {
        return requested;
    }
    let path = Path::new(file_name);
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("radio-track");
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("mp3");
    for suffix in 2.. {
        let candidate = directory.join(format!("{} ({}).{}", stem, suffix, extension));
        if !candidate.exists() {
            return candidate;
        }
    }
    unreachable!()
}

fn sanitize_file_name(value: &str, fallback: &str) -> String {
    let invalid: HashSet<char> = ['<', '>', ':', '"', '/', '\\', '|', '?', '*']
        .into_iter()
        .collect();
    let sanitized = value
        .trim()
        .chars()
        .map(|character| {
            if invalid.contains(&character) {
                '_'
            } else {
                character
            }
        })
        .collect::<String>()
        .trim_matches([' ', '.'])
        .to_string();
    if sanitized.is_empty() {
        fallback.to_string()
    } else {
        sanitized
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            clear_offline_tracks,
            delete_offline_track,
            list_offline_tracks,
            list_station_subscriptions,
            offline_track_location,
            read_offline_track,
            save_offline_track,
            save_station_subscriptions,
            save_cached_track
        ])
        .run(tauri::generate_context!())
        .expect("error while running Music Library");
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopOfflineTrack {
    key: String,
    name: String,
    size: u64,
    saved_at: String,
    station_name: Option<String>,
    content_type: String,
}

#[tauri::command]
fn list_offline_tracks(app: tauri::AppHandle) -> Result<Vec<DesktopOfflineTrack>, String> {
    let root = offline_root(&app)?;
    let mut tracks = Vec::new();
    collect_offline_tracks(&root, &root, &mut tracks)?;
    tracks.sort_by(|left, right| right.saved_at.cmp(&left.saved_at));
    Ok(tracks)
}

#[tauri::command]
fn offline_track_location(app: tauri::AppHandle) -> Result<String, String> {
    Ok(offline_root(&app)?.to_string_lossy().into_owned())
}

#[tauri::command]
fn save_offline_track(
    app: tauri::AppHandle,
    content: Vec<u8>,
    file_name: String,
    station_name: Option<String>,
) -> Result<DesktopOfflineTrack, String> {
    let root = offline_root(&app)?;
    let directory = station_name
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .map(|value| root.join(sanitize_file_name(value, "Station")))
        .unwrap_or_else(|| root.clone());
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let destination = available_destination(
        &directory,
        &sanitize_file_name(&file_name, "radio-track.mp3"),
    );
    std::fs::write(&destination, content).map_err(|error| error.to_string())?;
    offline_track(&destination, &root)
}

#[tauri::command]
fn read_offline_track(app: tauri::AppHandle, key: String) -> Result<Vec<u8>, String> {
    std::fs::read(validated_offline_path(&app, &key)?).map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_offline_track(app: tauri::AppHandle, key: String) -> Result<(), String> {
    std::fs::remove_file(validated_offline_path(&app, &key)?)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn clear_offline_tracks(app: tauri::AppHandle) -> Result<(), String> {
    let root = offline_root(&app)?;
    std::fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
    std::fs::create_dir_all(root).map_err(|error| error.to_string())
}