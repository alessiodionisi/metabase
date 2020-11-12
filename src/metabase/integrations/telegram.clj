(ns metabase.integrations.telegram
  (:require [cheshire.core :as json]
            [clj-http.client :as http]
            [clojure.core.memoize :as memoize]
            [clojure.java.io :as io]
            [clojure.tools.logging :as log]
            [medley.core :as m]
            [metabase.models.setting :as setting :refer [defsetting]]
            [metabase.util :as u]
            [metabase.util
             [i18n :refer [deferred-tru trs tru]]
             [schema :as su]]
            [schema.core :as s]))

(defsetting telegram-token (deferred-tru "Telegram API token obtained from https://t.me/BotFather"))

(def ^:private ^String telegram-api-base-url "https://api.telegram.org")

(defn telegram-configured?
  "Is Telegram integration configured?"
  []
  (boolean (seq (telegram-token))))

(defn- handle-error [body]
  (let [message (tru "Telegram API error: {0}" (:description body))
        error {:error-code (:error_code body)
               :message    message
               :response   body}]
    (log/warn (u/pprint-to-str 'red error))
    (throw (ex-info message error))))

(defn- handle-response [{:keys [status body]}]
  (with-open [reader (io/reader body)]
    (let [body (json/parse-stream reader true)]
      (if (and (= 200 status) (:ok body))
        body
        (handle-error body)))))

(defn- do-telegram-request [token request-fn endpoint request]
  (let [url     (str telegram-api-base-url "/" "bot" token "/" (name endpoint))
        _       (log/trace "Telegram API request: %s %s" (pr-str url) (pr-str request))
        request (merge-with merge
                            {:as             :stream
                             :conn-timeout   10000
                             :socket-timeout 10000
                             :throw-exceptions false}
                            request)]
    (try
      (handle-response (request-fn url request))
      (catch Throwable e
        (throw (ex-info (.getMessage e) (merge (ex-data e) {:url url, :request request}) e))))))

(defn get-request
  "Make a GET request to the Telegram API."
  [endpoint & {:as query-params}]
  (do-telegram-request (telegram-token) http/get endpoint {:query-params query-params}))

(defn get-request-with-token
  "Make a GET request to the Telegram API with a different token."
  [token endpoint & {:as query-params}]
  (do-telegram-request token http/get endpoint {:query-params query-params}))

(defn post-request
  "Make a POST request to the Telegram API."
  [endpoint body]
  (do-telegram-request (telegram-token) http/post endpoint {:form-params body}))

(s/defn valid-token?
  "Check whether a Telegram token is valid by checking whether we can call `getMe` method with it."
  [token :- su/NonBlankString]
  (try
    (get-request-with-token token "getMe" :token token)
    (catch Throwable e
      (if (= (:error-code (ex-data e)) 401)
        false
        (throw e)))))
