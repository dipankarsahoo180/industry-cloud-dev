import { api, LightningElement } from 'lwc';
import { CloseActionScreenEvent } from 'lightning/actions';
import { NavigationMixin } from 'lightning/navigation';
import {
    getFocusedTabInfo,
    getTabInfo,
    openSubtab
} from 'lightning/platformWorkspaceApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class GiftEntryPostProcessingLauncher extends NavigationMixin(LightningElement) {
    @api recordId;

    @api
    async invoke() {
        if (!this.recordId) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Unable to open post processing',
                    message: 'Gift Batch record id was not available.',
                    variant: 'error'
                })
            );
            return;
        }

        const pageReference = {
            type: 'standard__component',
            attributes: {
                componentName: 'c__giftEntryPostProcessing'
            },
            state: {
                c__recordId: this.recordId
            }
        };

        try {
            await this.openAsSubtab(pageReference);
            this.dispatchEvent(new CloseActionScreenEvent());
        } catch (error) {
            await this.openBrowserFallback(pageReference, error);
            this.dispatchEvent(new CloseActionScreenEvent());
        }
    }

    async openAsSubtab(pageReference) {
        const focusedTabInfo = await getFocusedTabInfo();
        const parentTabInfo = focusedTabInfo.isSubtab
            ? await getTabInfo(focusedTabInfo.parentTabId)
            : focusedTabInfo;
        const parentTabId = parentTabInfo.tabId;

        await openSubtab(parentTabId, {
            pageReference,
            focus: true,
            icon: 'standard:gift_entry',
            iconAlt: 'Gift Entry',
            label: 'Gift Entry Post Processing'
        });
    }

    async openBrowserFallback(pageReference, originalError) {
        const newWindow = window.open('about:blank', '_blank');

        try {
            const url = await this[NavigationMixin.GenerateUrl](pageReference);

            if (newWindow) {
                newWindow.opener = null;
                newWindow.location.href = url;
            } else {
                window.open(url, '_blank', 'noopener,noreferrer');
            }
        } catch (error) {
            if (newWindow) {
                newWindow.close();
            }

            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Unable to open post processing',
                    message:
                        error?.message ||
                        originalError?.message ||
                        'An unexpected navigation error occurred.',
                    variant: 'error'
                })
            );
        }
    }
}
