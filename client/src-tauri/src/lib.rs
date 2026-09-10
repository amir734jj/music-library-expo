use serde::{Deserialize, Serialize};
use std::{collections::HashSet, path::Path};
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
            list_station_subscriptions,
            save_station_subscriptions,
            save_cached_track
        ])
        .run(tauri::generate_context!())
        .expect("error while running Music Library");
}