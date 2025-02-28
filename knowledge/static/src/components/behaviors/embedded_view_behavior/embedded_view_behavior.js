/** @odoo-module */

import { AbstractBehavior } from "@knowledge/components/behaviors/abstract_behavior/abstract_behavior";
import { EmbeddedViewManager } from "@knowledge/components/behaviors/embedded_view_behavior/embedded_view_manager";
import { makeContext } from "@web/core/context";
import {
    decodeDataBehaviorProps,
    encodeDataBehaviorProps,
    setIntersectionObserver
} from "@knowledge/js/knowledge_utils";
import { useService } from "@web/core/utils/hooks";
import { uuid } from "@web/views/utils";

const {
    onError,
    onMounted,
    onWillUnmount,
    useState,
    useSubEnv } = owl;

/**
 * This component will have the responsibility to load the embedded view lazily
 * when it becomes visible on screen. The component will also have the responsibility
 * to handle errors that may occur when loading an embedded view.
 */
export class EmbeddedViewBehavior extends AbstractBehavior {
    setup () {
        super.setup();
        this.actionService = useService('action');
        this.state = useState({
            waiting: true,
            error: false
        });

        let embeddedViewId = this.props.embedded_view_id;
        if (!embeddedViewId) {
            embeddedViewId = uuid();
            const { anchor } = this.props;
            anchor.dataset.behaviorProps = encodeDataBehaviorProps(Object.assign(
                decodeDataBehaviorProps(anchor.dataset.behaviorProps),
                { embedded_view_id: embeddedViewId }
            ));
        }

        useSubEnv({
            knowledgeEmbeddedViewId: embeddedViewId
        });

        onMounted(() => {
            const { anchor } = this.props;
            this.observer = setIntersectionObserver(anchor, async () => {
                await this.loadData();
                this.state.waiting = false;
            });
            /**
             * Capturing the events occuring in the embedded view to prevent the
             * default behavior of the editor.
             */
            const stopEventPropagation = event => event.stopPropagation();
            anchor.addEventListener('keydown', stopEventPropagation);
            anchor.addEventListener('keyup', stopEventPropagation); // power box
            anchor.addEventListener('input', stopEventPropagation);
            anchor.addEventListener('beforeinput', stopEventPropagation);
            anchor.addEventListener('paste', stopEventPropagation);
            anchor.addEventListener('drop', stopEventPropagation);
        });

        onWillUnmount(() => {
            if (this.observer) {
                this.observer.unobserve(this.props.anchor);
            }
        });

        onError(error => {
            console.error(error);
            this.state.error = true;
        });
    }

    async loadData () {
        const context = makeContext([this.props.context]);
        const action = await this.actionService.loadAction(this.props.act_window, context);
        if (action.type !== "ir.actions.act_window") {
            this.state.error = true;
            return;
        }
        if (this.props.action_help) {
            action.help = this.props.action_help;
        }
        Object.assign(this.props, {
            act_window: action,
            context: context
        });
    }

    /**
     * Set the title of the embedded view.
     * @param {String} name
     */
    setTitle (name) {
        const data = decodeDataBehaviorProps(this.props.anchor.getAttribute('data-behavior-props'));
        data.act_window.name = name;
        data.act_window.display_name = name;
        this.props.anchor.setAttribute('data-behavior-props', encodeDataBehaviorProps(data));
        Object.assign(this.props.act_window, {
            name: name,
            display_name: name
        });
        const title = this.props.anchor.querySelector('.o_control_panel .breadcrumb-item.active');
        if (title) {
            title.textContent = name;
        }
    }

    /**
     * Get the title of the embedded view.
     * @returns {String}
     */
    getTitle () {
        if (this.props.act_window) {
            return this.props.act_window.display_name || this.props.act_window.name;
        }
        return '';
    }
}

EmbeddedViewBehavior.template = "knowledge.EmbeddedViewBehavior";
EmbeddedViewBehavior.components = {
    EmbeddedViewManager,
};
EmbeddedViewBehavior.props = {
    ...AbstractBehavior.props,
    embedded_view_id: { type: String, optional: true },
    act_window: { type: Object },
    context: { type: Object },
    view_type: { type: String },
    action_help: { type: Object, optional: true},
};
