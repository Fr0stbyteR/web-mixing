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

const REPOSITORY_URL = "../../web-mixing-data/list.json";
const AUDIO_CONTEXT = new AudioContext({ latencyHint: 0.0001 });

const App: React.FunctionComponent<Props> = ({ repositoryUrl = REPOSITORY_URL, audioContext = AUDIO_CONTEXT }) => {
    const [audioEditor, setAudioEditor] = useState<AudioEditor | null>(null);
    const [questData, setQuestData] = useState<QuestData[string] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(0);
    const { searchParams } = new URL(location.href);
    const quest = searchParams.get("q");
    const repo = searchParams.get("list") || repositoryUrl;
    useEffect(() => {
        (async () => {
            try {
                const dataResponse = await fetch(repo);
                const data: QuestData = await dataResponse.json();
                setQuestData(quest ? data[quest] || null : null);
            } catch (error) {
                setError((error as Error).toString());
            }
        })();
    }, [quest, repo, repositoryUrl]);
    useEffect(() => {
        (async () => {
            if (!quest) setError("Data not found");
            if (!quest || !questData) return;
            setError(null);
            const { searchParams } = new URL(location.href);
            const gains = searchParams.get("g")?.split("_").map(v => +v || 0);
            const masterGain = searchParams.get("m");
            const groupingString = searchParams.get("gr");
            const grouping = groupingString ? AudioEditor.fromGroupingString(groupingString) : [];
            const { files, path, pans } = questData;
            const audioBuffers = await Promise.all(files.map(async (fileName) => {
                const url = new URL(`${path}/${fileName}`, new URL(repositoryUrl, location.href));
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                setLoaded(v => v + 1);
                return audioContext.decodeAudioData(arrayBuffer);
            }));
            const trackGains = new Array(audioBuffers.length).fill(0);
            const trackPans = new Array(audioBuffers.length).fill(0);
            for (let i = 0; i < audioBuffers.length; i++) {
                if (gains) trackGains[i] = gains[i] || 0;
                if (pans) trackPans[i] = pans[i] || 0;
                if (grouping.findIndex(e => e.id === i) === -1) grouping.push({ id: i, linked: false });
            }
            const audioEditor = await AudioEditor.fromData(audioBuffers.map(ab => ab.getChannelData(0)), audioContext, quest);
            audioEditor.setState({
                trackNames: files.map(n => n.replace(/\.[^.]+$/, "")),
                trackPans,
                trackGains,
                ...(masterGain ? { masterGain: +masterGain || 0 } : {}),
                ...(grouping ? { grouping: grouping } : {})
            });
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
