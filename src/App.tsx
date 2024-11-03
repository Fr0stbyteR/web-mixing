import "./App.scss";
import { useEffect, useState } from "react";
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import { QuestData } from "./types";
import AudioEditor from "./core/AudioEditor";
import { AudioEditorContext } from "./components/contexts";
import AudioEditorContainer from "./components/AudioEditorContainer";

type Props = {
    repositoryUrl?: string
    audioContext?: AudioContext;
};

const REPOSITORY_URL = "http://localhost/web-mixing-data/list.json";
const AUDIO_CONTEXT = new AudioContext({ latencyHint: 0.0001 });

const App: React.FunctionComponent<Props> = ({ repositoryUrl = REPOSITORY_URL, audioContext = AUDIO_CONTEXT }) => {
    const [audioEditor, setAudioEditor] = useState<AudioEditor | null>(null);
    const [questData, setQuestData] = useState<QuestData[string] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(0);

    const quest = new URLSearchParams(location.search).get("q");
    useEffect(() => {
        (async () => {
            const dataResponse = await fetch(repositoryUrl);
            const data: QuestData = await dataResponse.json();
            setQuestData(quest ? data[quest] || null : null);
        })();
    }, [quest, repositoryUrl]);
    useEffect(() => {
        (async () => {
            if (!quest) setError("Data not found");
            if (!quest || !questData) return;
            setError(null);
            const { files, path, pans } = questData;
            const audioBuffers = await Promise.all(files.map(async (fileName) => {
                const url = new URL(`${path}/${fileName}`, repositoryUrl);
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                setLoaded(v => v + 1);
                return audioContext.decodeAudioData(arrayBuffer);
            }));
            const audioEditor = await AudioEditor.fromData(audioBuffers.map(ab => ab.getChannelData(0)), audioContext, quest);
            audioEditor.setState({ trackNames: files, trackPans: pans ?? new Array(audioBuffers.length).fill(0) });
            setAudioEditor(audioEditor);
            const handleKeyDown = async (e: KeyboardEvent) => {
                if (e.key !== " ") return;
                e.preventDefault();
                if (!audioEditor) return;
                if (audioEditor.context.state === "suspended") {
                    await audioEditor.context.resume();
                    // audioEditor.play();
                    // window.removeEventListener("keydown", handleKeyDown);
                }
                if (audioEditor.state.playing === "playing") audioEditor.stop();
                else audioEditor.play();
            };
            window.addEventListener("keydown", handleKeyDown);
        })();
    }, [audioContext, quest, questData, repositoryUrl])
    return (
        <div id="main-container">
            {
                audioEditor
                ? (
                    <AudioEditorContext.Provider value={audioEditor}>
                        <AudioEditorContainer />
                    </AudioEditorContext.Provider>
                )
                : error
                ? <div className="main-loading-error">{error}</div>
                : <div className="main-loading">
                    <VSCodeProgressRing />
                    <div>Loading... {questData ? `${loaded} / ${questData.files.length}` : ""}</div>
                </div>
            }
        </div>
    );
};

export default App;
