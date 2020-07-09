import Plugin from '@ckeditor/ckeditor5-core/src/plugin';

import Collection from '@ckeditor/ckeditor5-utils/src/collection';
import ButtonView from './button';
import BalloonPanelView from '@ckeditor/ckeditor5-ui/src/panel/balloon/balloonpanelview';
import LabeledFieldView from '@ckeditor/ckeditor5-ui/src/labeledfield/labeledfieldview';
import { createLabeledInputText } from '@ckeditor/ckeditor5-ui/src/labeledfield/utils';
import viewToPlainText from '@ckeditor/ckeditor5-clipboard/src/utils/viewtoplaintext';
import clickOutsideHandler from '@ckeditor/ckeditor5-ui/src/bindings/clickoutsidehandler';
import View from '@ckeditor/ckeditor5-ui/src/view';

import imageIcon from './icons/draft.svg';
import saveIcon from './icons/savedraft.svg';
import deleteIcon from './icons/bin.svg';
import XIcon from './icons/x.svg';

class Template extends Plugin {
	init() {
		this.temlateList();
		this.temlateSaveBtn();
    }

    temlateSaveBtn() {
    	const editor = this.editor;
		const t = editor.t;
        editor.ui.componentFactory.add('SaveTemplate', locale => {
            this.buttonView = this.createButton('შენახვა', true, 'შაბლონად შენახვა', saveIcon);
			this.buttonConfig = Object.assign({
				dotsOnCut: true,
			},
			editor.config.get('Template.button') || {});
			this.buttonView.set('class', 'ck ck-button');
			if (! this.buttonConfig.saveTemplateUrl) {
				console.error('template save url is required: "button.saveTemplateUrl"');
				return;
			}
			this.buttonView.ballon = new BalloonPanelView(locale);
			this.buttonView.ballon.set({class: 'p-3 template-panel save-panel', withArrow: false})
 			const positions = BalloonPanelView.defaultPositions;
			const labeledInput = new LabeledFieldView( locale, createLabeledInputText );
			labeledInput.label = 'შაბლონის სათაური';
			labeledInput.fieldView.placeholder = 'შეიყვანეთ შაბლონის სათაური';
			
			const cancelButton = this.createButton('გაუქმება', true);
			const saveButton = this.createButton('შენახვა', true);
			this.buttonView.ballon.content.add(labeledInput);
			this.buttonView.ballon.content.add(saveButton);
			this.buttonView.ballon.content.add(cancelButton);
			this.buttonView.ballon.on('render', () => {
				clickOutsideHandler( {
					emitter: this.buttonView.ballon,
					activator: () => this.buttonView.ballon.isVisible,
					callback: () => {
						this.buttonView.ballon.unpin();
					},
					contextElements: [ this.buttonView.ballon.element ]
				} );
			} );

			this.buttonView.ballon.render();
			editor.ui.view.main.add(this.buttonView.ballon);

			cancelButton.set('class', 'save-template-btn mt-3 pull-right btn btn-link');
			saveButton.set('class', 'save-template-btn mt-3 pull-right btn btn-primary');
			labeledInput.fieldView.element.setAttribute('class', 'form-control');

			labeledInput.fieldView.element.onkeyup = () => {
				saveButton.isEnabled = labeledInput.fieldView.element.value.length > 0
				this.TemplateLabel = labeledInput.fieldView.element.value;
			}
			editor.model.document.on('change:data', ()=>{
				this.buttonView.isEnabled = editor.getData().length > 0;
			})
			this.buttonView.isEnabled = editor.getData().length > 0;
		    this.buttonView.on('execute', () => {
		    	labeledInput.fieldView.value = this.TemplateLabel || this.getFirstLine(100, this.buttonConfig.dotsOnCut);
		    	if (labeledInput.fieldView.value.length == 0) {
		    		return;
		    	}
				this.buttonView.ballon.pin({
					target: this.buttonView.element,
				});
			});
			cancelButton.on('execute', () => {
				this.buttonView.ballon.unpin();
			});
			saveButton.on('execute', () => {
				let data = Object.assign(this.buttonConfig.postData || {}, {
					title: labeledInput.fieldView.element.value,
					descr: editor.getData(),
				});
				this.fetch(this.buttonConfig.saveTemplateUrl, data, 'POST')
				.then((e)=> {
					if (e.StatusCode == 0) {
						return;
					}
					data.template_id = e.Data.TemplateID;
					if (this.initDropdown) {
						this.addListItem(data);
					}
					this.setTemlatesCount(1);
				});
				this.buttonView.ballon.unpin();
			});

            return this.buttonView;
        });
    }

    temlateList() {
    	this.preventUnpinList = 0;
    	this.listLoading = true;
    	this.templateCount = 0;
        const editor = this.editor;
        this.initDropdown = false;
        this.TemplateLabel = '';
        editor.ui.componentFactory.add('Template', locale => {
            this.listButtonView = this.createButton('შაბლონები', true);
            this.dropdownView = new BalloonPanelView(locale);
			this.listConfig = editor.config.get('Template.list') || {};
			this.listContainer = this.createListCont();
			this.dropdownView.cancelBtn = this.createButton('დახურვა', true, false, XIcon, 'ck ck-button btn-link btn list-cancel-btn');
			if (! this.listConfig.getTemplatesUrl) {
				console.error('template list url is required: "list.getTemplatesUrl"');
				return;
			}
			let data = this.listConfig.postData || {};

			this.dropdownView.set({class: 'pt-3 template-list template-panel', withArrow: false});
			this.setLoading();
			if ( this.listConfig.getTemplatesCount ) {
				this.listButtonView.isEnabled = false;
				this.fetch(this.listConfig.getTemplatesCount, data, 'GET').then((res)=> {
					this.setTemlatesCount(parseInt(res.Data) || 0);
				});
			}
			this.listButtonView.set('class', 'ck ck-button');
			this.listButtonView.on('execute', ()=> {
				if (! this.initDropdown) {
					this.initDropdown = true;
					this.setItems();
				}
				if (this.templateCount > 0) {
					this.dropdownView.pin({
						target: this.listButtonView.element
					});
				}
			});
			this.dropdownView.on('render', () => {
				clickOutsideHandler( {
					emitter: this.dropdownView,
					activator: () => this.dropdownView.isVisible,
					callback: () => {
						if (this.preventUnpinList > 0) {
							this.preventUnpinList -= 1;
							return;
						}
						this.dropdownView.unpin();
					},
					contextElements: [ this.dropdownView.element ]
				});
			});

			this.dropdownView.cancelBtn.on('execute', ()=>this.dropdownView.unpin());
			this.dropdownView.render();
			editor.ui.view.main.add(this.dropdownView);
            return this.listButtonView;
        });
    }

    async setItems() {
        const items = new Collection();
        let data = await this.fetch(this.listConfig.getTemplatesUrl, this.listConfig.postData || {});
        data = data.Data;
       	this.clearListLoading();
		for (let i = 0, l = data.length; i < l; i++) {
    		items.add(this.listItem(data[i]));
    	}
    	this.addListToDropdown(items);
		// Add the option to the collection.
    }

    addListItem(data) {
    	const item = new Collection();
    	this.clearListLoading();
    	item.add(this.listItem(data));
    	this.addListToDropdown(item);
    }

    listItem(item) {
    	return {
			label: item.title,
			descr: item.descr,
			replaceAll: item.replaceAll || false,
			class: item.class ? item.class : '',
			isLoading: false,
			withText: true,
			template_id: item.template_id
		}
    }

    setLoading() {
		const button = new ButtonView( this.editor.locale );
		button.set( {
			label: 'loading ... ',
			isLoading: true,
			class: 'disabled ck ck-button',
			isOn: false,
			withText: true,
			isEnabled: false
		});
		this.dropdownView.content.add( button );
    }

    setEditorContent(content, replaceAll) {
    	const viewFragment = this.editor.data.processor.toView(content);
	    const modelFragment = this.editor.data.toModel( viewFragment );
	    if (replaceAll) {
	    	this.editor.execute('selectAll');
	    }
	    this.editor.model.insertContent(modelFragment);
    }

    setTemplateLabel(label) {
    	this.TemplateLabel = label;
    }

    createButton(label, withText, tooltip, icon, clas) {
    	const button = new ButtonView( this.editor.locale );
		button.set( {
			label:label,
			withText: withText || false,
			icon: icon || false,
			tooltip: tooltip || false,
			class:clas
		});
		return button;
    }

    getFirstLine(charCount = 30, dots = false) {
    	let content = viewToPlainText(this.editor.editing.view.document.getRoot()).split('\n');
    	let i = 0;
    	while (i < content.length) {
    		let ret = content[i].replace(/(^\s+)|(\s+$)/, '');
    		if (ret.length == 0) {
    			i++;
    			continue;
    		}
    		if (ret.length > charCount) {
    			ret = ret.substr(0, charCount) + (dots ? '...' : '');
    		}
    		return ret;
    	}
    	return '';
    }

    async fetch (url, data = {}, method = 'GET') {
    	method = method.toUpperCase();
    	let req = {
				method: method, // *GET, POST, PUT, DELETE, etc.
				mode: 'cors', // no-cors, *cors, same-origin
				cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
				credentials: 'same-origin', // include, *same-origin, omit
				redirect: 'follow', // manual, *follow, error
				referrerPolicy: 'no-referrer'
			}
		if (method !== 'GET' && method !== 'HEAD' && data) {
			const formData = new FormData();
			Object.entries(data).map(e =>{
				formData.append(e[0], e[1]);
			});
			req.body = formData; // body data type must match "Content-Type" header
		} else if (data) {
			Object.entries(data).map(e =>{
				url += (url.indexOf('?') > -1 ? '&' : '?') + e[0] + '=' + e[1];
			});
		}
    	const response = await fetch(url, req);
  		return response.json();
    }

    clearListLoading() {
    	if (this.listLoading) {
			this.dropdownView.content.clear();
			const div = this.createDiv('list-container-wrap');
			div.children.add(this.listContainer);
			this.dropdownView.content.add(div);
			this.dropdownView.content.add(this.dropdownView.cancelBtn);
    		this.listLoading = false;
    	}
    }

    addListToDropdown( items ) {
    	items.map((model) => {
    		const listItemView = this.createListItem();
			const buttonView = this.createButton(model.label, true, false);
			buttonView.set({
				descr: model.descr,
				replaceAll: model.replaceAll || false,
				isLoading: false,
				template_id: model.template_id
			});
			buttonView.on('execute', (evt)=>{
				let replaceAll = !!(this.listConfig.replaceAll || evt.source.replaceAll);
				this.setEditorContent(evt.source.descr, replaceAll);
				this.setTemplateLabel(evt.source.label);
				this.dropdownView.unpin();
				this.editor.editing.view.focus();
			});
			buttonView.set('class', 'template-item pl-3 pr-3');
			// Bind all model properties to the button view.
			listItemView.children.add( buttonView );
			if (this.listConfig.deleteUrl && model.template_id) {
				const deleteButton = this.createButton('', false, 'წაშლა', deleteIcon, 'btn ck ck-button delete-template-btn');
				listItemView.children.add( deleteButton );
				deleteButton.on('execute', ()=> {
			    	this.preventUnpin();
					swal({
				        title: lang.DeleteQuestion,
				        type: 'question',
				        showCancelButton: true,
				        cancelButtonText: lang.No,
				        confirmButtonText: lang.Yes
				    }).then((result) => {
				        if (result.value) {
							this.deleteTemplate(model.template_id, listItemView);
				        } else {
				        	this.dropdownView.pin({target: this.listButtonView});
				        }
				    });
				})
			}
			this.listContainer.children.add(listItemView);
		});
	}

	async deleteTemplate(templateId, listItem) {
		let data = Object.assign(this.listConfig.postData || {}, {
			template_id: templateId
		});
		this.fetch(this.listConfig.deleteUrl, data, 'POST').then(e => {
			listItem.destroy();
			listItem.element.remove();
			this.setTemlatesCount(-1);
		});
	}

	setTemlatesCount(cnt) {
		if (this.templateCount == 0 && cnt > 0 ) {
			this.listButtonView.isEnabled = true;
		}
		this.templateCount += cnt;
		this.listButtonView.set({
			label: 'შაბლონები(' + this.templateCount + ')'
		});
		if (this.templateCount == 0) {
			this.listButtonView.isEnabled = false;
			this.dropdownView.unpin();
		}

	}

	createListItem() {
		const item = new View(this.editor.locale)
		item.children = item.createCollection();

		item.setTemplate( {
			tag: 'li',
			attributes: {
				class: [
					'w-100',
					'position-relative',
					'pl-3',
					'pr-3',
				]
			},

			children: item.children
		} );
		return item;
	}

	createListCont() {
		const item = new View(this.editor.locale)
		item.children = item.createCollection();

		item.setTemplate({
			tag: 'ol',

			attributes: {
				class: [
					'position-relative',
					'template-list-cont'
				]
			},

			children: item.children
		});
		return item;
	}
	createDiv(cls) {
		const item = new View(this.editor.locale)
		item.children = item.createCollection();

		item.setTemplate({
			tag: 'div',

			attributes: {
				class: (cls || '').split(' ')
			},

			children: item.children
		});
		return item;
	}

	preventUnpin() {
		this.preventUnpinList ++;
	}

    static get pluginName() {
		return 'Template';
	}
}

export default Template;