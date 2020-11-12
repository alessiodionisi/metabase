(ns metabase.api.telegram
  "/api/telegram endpoints"
  (:require [compojure.core :refer [PUT]]
            [metabase.api.common :as api]
            [metabase.config :as config]
            [metabase.integrations.telegram :as telegram]
            [metabase.models.setting :as setting]
            [metabase.util
             [i18n :refer [tru]]
             [schema :as su]]
            [schema.core :as s]))

(api/defendpoint PUT "/settings"
  "Update Telegram related settings. You must be a superuser to do this."
  [:as {{telegram-token :telegram-token, :as telegram-settings} :body}]
  {telegram-token (s/maybe su/NonBlankString)}
  (api/check-superuser)
  (if-not telegram-token
    (setting/set-many! {:telegram-token nil})
    (try
      (when-not config/is-test?
        (when-not (telegram/valid-token? telegram-token)
          (throw (ex-info (tru "Invalid Telegram token.") {:status-code 400}))))
      (setting/set-many! telegram-settings)
      {:ok true}
      (catch clojure.lang.ExceptionInfo info
        {:status 400, :body (ex-data info)}))))

(api/define-routes)
