import "./App.scss";
import { useEffect, useState } from "react";
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import { QuestData } from "./types";
import AudioEditor from "./core/AudioEditor";
import { AudioEditorContext } from "./components/contexts";
import AudioEditorContainer from "./components/AudioEditorContainer";

type Props = {};
const audioContext = new AudioContext({ latencyHint: 0.0001 });

const App: React.FunctionComponent<Props> = () => {
    const [audioEditor, setAudioEditor] = useState<AudioEditor | null>(null);
    const [questData, setQuestData] = useState<QuestData[string] | null>(null);
    const quest = new URLSearchParams(location.search).get("q");
    useEffect(() => {
        (async () => {
            const dataResponse = await fetch("./data/list.json");
            const data: QuestData = await dataResponse.json();
            setQuestData(quest ? data[quest] || null : null);
        })();
    }, []);
    useEffect(() => {
        (async () => {
            if (!quest || !questData) return;
            const { files, path } = questData;
            const audioBuffers = await Promise.all(files.map(async (fileName) => {
                const url = `${path}/${fileName}`;
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                return audioContext.decodeAudioData(arrayBuffer);
            }));
            const audioBuffer = audioContext.createBuffer(audioBuffers.length, audioBuffers[0].length, audioBuffers[0].sampleRate);
            for (let i = 0; i < audioBuffers.length; i++) {
                audioBuffer.copyToChannel(audioBuffers[i].getChannelData(0), i);
            }
            const audioEditor = await AudioEditor.fromData(audioBuffer, audioContext, quest);
            audioEditor.setState({ trackNames: files });
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
    }, [questData])
    return (
        <div id="main-container">
            {audioEditor ? (
                <AudioEditorContext.Provider value={audioEditor}>
                    <AudioEditorContainer />
                </AudioEditorContext.Provider>
            ) : <VSCodeProgressRing />}
        </div>
    );
};

export default App;
