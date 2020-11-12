import React, { Component } from "react";
import { connect } from "react-redux";
import PropTypes from "prop-types";

import MetabaseAnalytics from "metabase/lib/analytics";
import MetabaseUtils from "metabase/lib/utils";
import SettingsSetting from "./SettingsSetting";
import { updateTelegramSettings } from "../settings";

import Button from "metabase/components/Button";
import Icon from "metabase/components/Icon";

import _ from "underscore";
import { t, jt } from "ttag";

@connect(
  null,
  { updateSettings: updateTelegramSettings },
)
export default class SettingsTelegramForm extends Component {
  constructor(props, context) {
    super(props, context);

    this.state = {
      formData: {},
      submitting: "default",
      valid: false,
      validationErrors: {},
    };
  }

  static propTypes = {
    elements: PropTypes.array,
    formErrors: PropTypes.object,
    updateSettings: PropTypes.func.isRequired,
  };

  componentWillMount() {
    // this gives us an opportunity to load up our formData with any existing values for elements
    const formData = {};
    this.props.elements.forEach(function(element) {
      formData[element.key] =
        element.value == null ? element.defaultValue : element.value;
    });

    this.setState({ formData });
  }

  componentDidMount() {
    this.validateForm();
  }

  componentDidUpdate() {
    this.validateForm();
  }

  setSubmitting(submitting) {
    this.setState({ submitting });
  }

  setFormErrors(formErrors) {
    this.setState({ formErrors });
  }

  // return null if element passes validation, otherwise return an error message
  validateElement([validationType, validationMessage], value, element) {
    if (MetabaseUtils.isEmpty(value)) {
      return;
    }

    switch (validationType) {
      case "email":
        return !MetabaseUtils.validEmail(value)
          ? validationMessage || t`That's not a valid email address`
          : null;
      case "integer":
        return isNaN(parseInt(value))
          ? validationMessage || t`That's not a valid integer`
          : null;
    }
  }

  validateForm() {
    const { elements } = this.props;
    const { formData } = this.state;

    let valid = true;
    const validationErrors = {};

    elements.forEach(function(element) {
      // test for required elements
      if (element.required && MetabaseUtils.isEmpty(formData[element.key])) {
        valid = false;
      }

      if (element.validations) {
        element.validations.forEach(function(validation) {
          validationErrors[element.key] = this.validateElement(
            validation,
            formData[element.key],
            element,
          );
          if (validationErrors[element.key]) {
            valid = false;
          }
        }, this);
      }
    }, this);

    if (
      this.state.valid !== valid ||
      !_.isEqual(this.state.validationErrors, validationErrors)
    ) {
      this.setState({ valid, validationErrors });
    }
  }

  handleChangeEvent(element, value, event) {
    this.setState({
      formData: {
        ...this.state.formData,
        [element.key]: MetabaseUtils.isEmpty(value) ? null : value,
      },
    });
  }

  handleFormErrors(error) {
    // parse and format
    const formErrors = {};
    if (error.data && error.data.message) {
      formErrors.message = error.data.message;
    } else {
      formErrors.message = t`Looks like we ran into some problems`;
    }

    if (error.data && error.data.errors) {
      formErrors.elements = error.data.errors;
    }

    return formErrors;
  }

  updateTelegramSettings(e) {
    e.preventDefault();

    this.setState({
      formErrors: null,
      submitting: "working",
    });

    const { formData, valid } = this.state;

    if (valid) {
      this.props.updateSettings(formData).then(
        () => {
          this.setState({
            submitting: "success",
          });

          MetabaseAnalytics.trackEvent(
            "Telegram Settings",
            "Update",
            "success",
          );

          // show a confirmation for 3 seconds, then return to normal
          setTimeout(() => this.setState({ submitting: "default" }), 3000);
        },
        error => {
          this.setState({
            submitting: "default",
            formErrors: this.handleFormErrors(error),
          });

          MetabaseAnalytics.trackEvent("Telegram Settings", "Update", "error");
        },
      );
    }
  }

  render() {
    const { elements } = this.props;
    const {
      formData,
      formErrors,
      submitting,
      valid,
      validationErrors,
    } = this.state;

    const settings = elements.map((element, index) => {
      // merge together data from a couple places to provide a complete view of the Element state
      const errorMessage =
        formErrors && formErrors.elements
          ? formErrors.elements[element.key]
          : validationErrors[element.key];
      const value =
        formData[element.key] == null
          ? element.defaultValue
          : formData[element.key];

      if (element.key === "telegram-token") {
        return (
          <SettingsSetting
            key={element.key}
            setting={{ ...element, value }}
            onChange={value => this.handleChangeEvent(element, value)}
            errorMessage={errorMessage}
            fireOnChange
          />
        );
      }
    });

    const saveSettingsButtonStates = {
      default: t`Save changes`,
      working: t`Saving...`,
      success: t`Changes saved!`,
    };

    const disabled = !valid || submitting !== "default";
    const saveButtonText = saveSettingsButtonStates[submitting];

    return (
      <form noValidate>
        <div className="px2" style={{ maxWidth: "585px" }}>
          <h1>{t`Metabase`} Telegram</h1>
          <h3 className="text-light">{t`Answers sent right to your Telegram channel`}</h3>

          <div className="pt3">
            <a
              href="https://t.me/BotFather"
              target="_blank"
              className="Button Button--primary"
              style={{ padding: 0 }}
            >
              <div className="float-left py2 pl2">{t`Create a new Telegram Bot with @BotFather`}</div>
              <Icon
                className="float-right p2 text-white cursor-pointer"
                style={{ opacity: 0.6 }}
                name="external"
                size={18}
              />
            </a>
          </div>
          <div className="py2">
            {jt`Once you're there, use the ${(
              <strong>/newbot</strong>
            )} command to create a new Bot. Then copy and paste the generated API Token into the field below. Once you are done, add your new Bot as channel administrator with ${(
              <strong>"Post Messages"</strong>
            )} permission. Metabase needs this to send updates to your channel.`}
          </div>
        </div>
        <ul>
          {settings}
          <li className="m2 mb4">
            <Button
              mr={2}
              primary={!disabled}
              success={submitting === "success"}
              disabled={disabled}
              onClick={this.updateTelegramSettings.bind(this)}
            >
              {saveButtonText}
            </Button>
            {formErrors && formErrors.message ? (
              <span className="pl2 text-error text-bold">
                {formErrors.message}
              </span>
            ) : null}
          </li>
        </ul>
      </form>
    );
  }
}
