
//  LauncherOSX
//
//  Created by Boris Schneiderman.
//  Copyright (c) 2012-2013 The Readium Foundation.
//
//  The Readium SDK is free software: you can redistribute it and/or modify
//  it under the terms of the GNU General Public License as published by
//  the Free Software Foundation, either version 3 of the License, or
//  (at your option) any later version.
//
//  This program is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU General Public License for more details.
//
//  You should have received a copy of the GNU General Public License
//  along with this program.  If not, see <http://www.gnu.org/licenses/>.



ReadiumSDK.Views.ReflowableView = Backbone.View.extend({

    el: 'body',
    currentSpineItem: undefined,
    isWaitingFrameRender: false,
    deferredPageRequest: undefined,
    spine: undefined,

    lastViewPortSize : {
        width: undefined,
        height: undefined
    },

    paginationInfo : {

        visibleColumnCount : 2,
        columnGap : 20,
        spreadCount : 0,
        currentSpread : 0,
        columnWidth : undefined,
        pageOffset : 0,
        columnCount: 0
    },

    initialize: function() {

        this.spine = this.options.spine;

        this.template = _.template($("#template-reflowable-view").html());
        var html = this.template({});
        this.$el.append(html);

        this.$viewport = $("#viewport");
        this.$iframe = $("#epubContentIframe");

        this.navigation = new ReadiumSDK.Views.CfiNavigationLogic({paginationInfo: this.paginationInfo});

        //event with namespace for clean unbinding
        $(window).on("resize.ReadiumSDK.reflowableView", _.bind(this.onViewportResize, this));
    },

    remove: function() {

        $(window).off("resize.ReadiumSDK.readerView");

        //base remove
        Backbone.View.prototype.remove.call(this);
    },

    onViewportResize: function() {

        if(this.updateViewportSize()) {
            this.updatePagination();
        }

    },

    registerTriggers: function (doc) {
        $('trigger', doc).each(function() {
            var trigger = new ReadiumSDK.Models.Trigger(this);
            trigger.subscribe(doc);

        });
    },

    loadSpineItem: function(spineItem) {

        if(this.currentSpineItem != spineItem) {

            this.paginationInfo.currentSpread = 0;
            this.currentSpineItem = spineItem;
            this.isWaitingFrameRender = true;

            var src = this.spine.getItemUrl(spineItem);
            ReadiumSDK.Helpers.LoadIframe(this.$iframe[0], src, this.onIFrameLoad, this);
        }
    },

    onIFrameLoad : function(success) {

        this.isWaitingFrameRender = false;

        //while we where loading frame new request came
        if(this.deferredPageRequest && this.deferredPageRequest.spineItem != this.currentSpineItem) {
            this.loadSpineItem(this.deferredPageRequest.spineItem);
            return;
        }

        if(!success) {
            this.deferredPageRequest = undefined;
            return;
        }

        var epubContentDocument = this.$iframe[0].contentDocument;
        this.$epubHtml = $("html", epubContentDocument);

        this.$epubHtml.css("height", "100%");
        this.$epubHtml.css("position", "absolute");
        this.$epubHtml.css("-webkit-column-axis", "horizontal");
        this.$epubHtml.css("-webkit-column-gap", this.paginationInfo.columnGap + "px");

/////////
//Columns Debugging
//                    $epubHtml.css("-webkit-column-rule-color", "red");
//                    $epubHtml.css("-webkit-column-rule-style", "dashed");
//                    $epubHtml.css("background-color", '#b0c4de');
/////////

        this.updateViewportSize();
        this.updatePagination();

        this.applySwitches(epubContentDocument);
        this.registerTriggers(epubContentDocument);


        this.openDeferredElement()
    },

    openDeferredElement: function() {

        if(!this.deferredPageRequest) {
           return;
        }

        var deferredData = this.deferredPageRequest;
        this.deferredPageRequest = undefined;
        this.openPage(deferredData);

    },

    openPage: function(pageRequest) {

        if(this.isWaitingFrameRender) {
            this.deferredPageRequest = pageRequest;
            return;
        }

        // if no spine item specified we are talking about current spine item
        if(pageRequest.spineItem && pageRequest.spineItem != this.currentSpineItem) {
            this.deferredPageRequest = pageRequest;
            this.loadSpineItem(pageRequest.spineItem);
            return;
        }

        var pageIndex;

        if(pageRequest.pageIndex) {
            pageIndex = pageRequest.pageIndex;
        }
        else if(pageRequest.elementId) {
            pageIndex = this.navigation.getPageForElementId(pageRequest.elementId);
        }
        else if(pageRequest.elementCfi) {
            pageIndex = this.navigation.getPageForElementCfi(pageRequest.elementCfi);
        }

        if(pageIndex && pageIndex >= 0 && pageIndex < this.paginationInfo.spreadCount) {

            this.paginationInfo.currentSpread = pageIndex;
            this.onPaginationChanged();
        }
    },

    render: function(){

        if(this.paginationInfo.currentSpread < 0 || this.paginationInfo.currentSpread >= this.paginationInfo.spreadCount) {

            this.trigger("PageChanged", 0, 0, this.currentSpineItem ? this.currentSpineItem.idref : "");
            return this;
        }

        this.paginationInfo.pageOffset = (this.paginationInfo.columnWidth + this.paginationInfo.columnGap) * this.paginationInfo.visibleColumnCount * this.paginationInfo.currentSpread;

        this.$epubHtml.css("left", -this.paginationInfo.pageOffset + "px");

        return this;
    },

    updateViewportSize: function() {

        var newWidth = this.$viewport.width();
        var newHeight = this.$viewport.height();

        if(this.lastViewPortSize.width !== newWidth || this.lastViewPortSize.height !== newHeight){

            this.lastViewPortSize.width = newWidth;
            this.lastViewPortSize.height = newHeight;
            return true;
        }

        return false;
    },

    // Description: Parse the epub "switch" tags and hide
    // cases that are not supported
    applySwitches: function(dom) {

        // helper method, returns true if a given case node
        // is supported, false otherwise
        var isSupported = function(caseNode) {

            var ns = caseNode.attributes["required-namespace"];
            if(!ns) {
                // the namespace was not specified, that should
                // never happen, we don't support it then
                console.log("Encountered a case statement with no required-namespace");
                return false;
            }
            // all the xmlns that readium is known to support
            // TODO this is going to require maintenance
            var supportedNamespaces = ["http://www.w3.org/1998/Math/MathML"];
            return _.include(supportedNamespaces, ns);
        };

        $('switch', dom).each( function() {

            // keep track of whether or now we found one
            var found = false;

            $('case', this).each(function() {

                if( !found && isSupported(this) ) {
                    found = true; // we found the node, don't remove it
                }
                else {
                    $(this).remove(); // remove the node from the dom
//                    $(this).prop("hidden", true);
                }
            });

            if(found) {
                // if we found a supported case, remove the default
                $('default', this).remove();
//                $('default', this).prop("hidden", true);
            }
        })
    },

    openPagePrev:  function () {

        if(this.paginationInfo.currentSpread > 0) {
            this.paginationInfo.currentSpread--;
            this.onPaginationChanged();
        }
    },

    onPaginationChanged: function() {

        this.render();
        this.trigger("PageChanged", this.paginationInfo.currentSpread, this.paginationInfo.spreadCount, this.currentSpineItem.idref);
    },

    openPageNext: function () {

        console.log("OnNextPage()");

        if(this.paginationInfo.currentSpread < this.paginationInfo.spreadCount - 1) {
            this.paginationInfo.currentSpread++;
            this.onPaginationChanged();
        }
    },

    updatePagination: function() {

        if(!this.$epubHtml) {
            return;
        }

        this.paginationInfo.columnWidth = (this.lastViewPortSize.width - this.paginationInfo.columnGap * (this.paginationInfo.visibleColumnCount - 1)) / this.paginationInfo.visibleColumnCount;

        //we do this because CSS will floor column with by itself if it is nor round number
        this.paginationInfo.columnWidth = Math.floor(this.paginationInfo.columnWidth);

        this.$epubHtml.css("width", this.lastViewPortSize.width);
        this.$epubHtml.css("-webkit-column-width", this.paginationInfo.columnWidth + "px");

        //we will render on timer but rendering before gives better visual experience
        this.render();

        var self = this;
        //TODO it takes time for layout engine to arrange columns we waite
        //it would be better to react on layout column reflow finished event
        setTimeout(function(){

            var columnizedContentWidth = self.$epubHtml[0].scrollWidth;
            //we do this to prevent css from doing column optimization smarts.
            self.$iframe.css("width", columnizedContentWidth);

            self.paginationInfo.columnCount = Math.round((columnizedContentWidth + self.paginationInfo.columnGap) / (self.paginationInfo.columnWidth + self.paginationInfo.columnGap));

            self.paginationInfo.spreadCount =  Math.ceil(self.paginationInfo.columnCount / self.paginationInfo.visibleColumnCount);

            if(self.paginationInfo.currentSpread >= self.paginationInfo.spreadCount) {
                self.paginationInfo.currentSpread = self.paginationInfo.spreadCount - 1;
            }

            self.onPaginationChanged();

        }, 100);

    },

    getFirstVisibleElementCfi: function(){

        return this.navigation.getFirstVisibleElementCfi();
    },

    getPageForElementCfi: function(cfi) {

        return this.navigation.getPageForElementCfi(cfi);

    },

    getPageForElementId: function(id) {

        return this.navigation.getPageForElementId(id);
    },

    getPaginationInfo: function() {

        var paginationInfo = new ReadiumSDK.Models.CurrentPagesInfo(this.spine.items.length, this.spine.package.isFixedLayout);

        if(!this.currentSpineItem) {
            return paginationInfo;
        }

        var currentPage = this.paginationInfo.currentSpread * this.paginationInfo.visibleColumnCount;

        for(var i = 0; i < this.paginationInfo.visibleColumnCount && (currentPage + i) < this.paginationInfo.columnCount; i++) {

            paginationInfo.addOpenPage(currentPage + i, this.paginationInfo.columnCount, this.currentSpineItem.idref, this.currentSpineItem.index);
        }

        return paginationInfo;

    }

});
