import { Dispatch } from "@reduxjs/toolkit";
import { PersistedSessionInfo, SessionInfo } from "core";

import { llmCanGenerateInParallel } from "core/llm/autodetect";
import { stripImages } from "core/llm/countTokens";
import { useContext } from "react";
import { useSelector } from "react-redux";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { defaultModelSelector } from "../redux/selectors/modelSelectors";
import { newSession } from "../redux/slices/stateSlice";
import { RootState } from "../redux/store";

function truncateText(text: string, maxLength: number) {
  if (text.length > maxLength) {
    return text.slice(0, maxLength - 3) + "...";
  }
  return text;
}

function useHistory(dispatch: Dispatch) {
  const state = useSelector((state: RootState) => state.state);
  const defaultModel = useSelector(defaultModelSelector);
  const disableSessionTitles = useSelector(
    (store: RootState) => store.state.config.disableSessionTitles,
  );
  const ideMessenger = useContext(IdeMessengerContext);

  async function getHistory(): Promise<SessionInfo[]> {
    return await ideMessenger.request("history/list", undefined);
  }

  async function saveSession() {
    if (state.history.length === 0) return;

    const stateCopy = { ...state };
    dispatch(newSession());
    await new Promise((resolve) => setTimeout(resolve, 10));

    let title = truncateText(
      stripImages(stateCopy.history[0].message.content)
        .split("\n")
        .filter((l) => l.trim() !== "")
        .slice(-1)[0] || "",
      50,
    );

    if (
      false && // Causing maxTokens to be set to 20 for main requests sometimes, so disabling until resolved
      !disableSessionTitles &&
      llmCanGenerateInParallel(defaultModel.provider, defaultModel.model)
    ) {
      // let fullContent = "";
      // for await (const { content } of llmStreamChat(
      //   defaultModel.title,
      //   undefined,
      //   [
      //     ...stateCopy.history.map((item) => item.message),
      //     {
      //       role: "user",
      //       content:
      //         "Give a maximum 40 character title to describe this conversation so far. The title should help me recall the conversation if I look for it later. DO NOT PUT QUOTES AROUND THE TITLE",
      //     },
      //   ],
      //   { maxTokens: 20 }
      // )) {
      //   fullContent += content;
      // }
      // title = stripImages(fullContent);
    }

    const sessionInfo: PersistedSessionInfo = {
      history: stateCopy.history,
      title: title,
      sessionId: stateCopy.sessionId,
      workspaceDirectory: window.workspacePaths?.[0] || "",
    };
    return await ideMessenger.request("history/save", sessionInfo);
  }

  async function deleteSession(id: string) {
    return await ideMessenger.request("history/delete", { id });
  }

  async function loadSession(id: string): Promise<PersistedSessionInfo> {
    return await ideMessenger.request("history/load", { id });
  }

  async function loadLastSession(): Promise<PersistedSessionInfo> {
    const lastSessionId = getLocalStorage("lastSessionId");
    if (lastSessionId) {
      return await loadSession(lastSessionId);
    }
  }

  function getLastSessionId(): string {
    return getLocalStorage("lastSessionId");
  }

  return {
    getHistory,
    saveSession,
    deleteSession,
    loadSession,
    loadLastSession,
    getLastSessionId,
    updateSession,
    getSession,
  };
}

export default useHistory;
