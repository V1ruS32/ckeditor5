import Plugin from '@ckeditor/ckeditor5-core/src/plugin';

import Collection from '@ckeditor/ckeditor5-utils/src/collection';
import Model from '@ckeditor/ckeditor5-ui/src/model';
import ButtonView from '@ckeditor/ckeditor5-ui/src/button/buttonview';
import BalloonPanelView from '@ckeditor/ckeditor5-ui/src/panel/balloon/balloonpanelview';
import ListView from '@ckeditor/ckeditor5-ui/src/list/listview';
import ListItemView from '@ckeditor/ckeditor5-ui/src/list/listitemview';
import LabeledFieldView from '@ckeditor/ckeditor5-ui/src/labeledfield/labeledfieldview';
import { createLabeledInputText } from '@ckeditor/ckeditor5-ui/src/labeledfield/utils';
import { createDropdown } from '@ckeditor/ckeditor5-ui/src/dropdown/utils';
import viewToPlainText from '@ckeditor/ckeditor5-clipboard/src/utils/viewtoplaintext';
import clickOutsideHandler from '@ckeditor/ckeditor5-ui/src/bindings/clickoutsidehandler';

import imageIcon from './icons/draft.svg';
import saveIcon from './icons/savedraft.svg';
import deleteIcon from './icons/bin.svg';

class Template extends Plugin {
	init() {
		this.temlateList();
		this.temlateSaveBtn();
    }
    temlateSaveBtn() {
    	const editor = this.editor;
		const t = editor.t;
        editor.ui.componentFactory.add('SaveTemplate', locale => {
            this.buttonView = this.createButton('შენახვა', true, false, saveIcon);
			this.buttonConfig = Object.assign({
				dotsOnCut: true,
			},
			editor.config.get('Template.button') || {});
			if (! this.buttonConfig.saveTemplateUrl) {
				console.error('template save url is required: "button.saveTemplateUrl"');
				return;
			}
			this.buttonView.ballon = new BalloonPanelView(locale);
 			const positions = BalloonPanelView.defaultPositions;
			const labeledInput = new LabeledFieldView( locale, createLabeledInputText );
			labeledInput.fieldView.placeholder = 'სათაური';
			const saveButton = this.createButton('შენახვა', true);
			const cancelButton = this.createButton('გაუქმება', true);

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
			
		    this.buttonView.on('execute', () => {
		    	labeledInput.fieldView.value = this.getFirstLine(30, this.buttonConfig.dotsOnCut);
				this.buttonView.ballon.pin({
					target: this.buttonView.element
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
				.then((e)=>{
					data.template_id = e.Data.TemplateID;
					this.addListItem(data);
					this.setTemlatesCount(1);
				});
				this.buttonView.ballon.unpin();
			});

            return this.buttonView;
        });
    }

    temlateList() {
    	this.listLoading = true;
    	this.templateCount = 0;
        const editor = this.editor;
        let initDropdown = false;
        editor.ui.componentFactory.add('Template', locale => {
            this.dropdownView = createDropdown( locale );
			this.listConfig = editor.config.get('Template.list') || {};
			if (! this.listConfig.getTemplatesUrl) {
				console.error('template list url is required: "list.getTemplatesUrl"');
				return;
			}
			this.setLoading();
			let data = this.listConfig.postData || {};
			
			this.dropdownView.buttonView.set( {
				label: 'შაბლონები',
				isOn: false,
				withText: true,
				icon: false,
				tooltip: false,
				class: 'w-100'
			});
			if ( this.listConfig.getTemplatesCount ) {
				this.fetch(this.listConfig.getTemplatesCount, data, 'GET').then((res)=> {
					this.setTemlatesCount(parseInt(res.Data) || 0);
				});
			}
			this.dropdownView.buttonView.on('execute', ()=>{
				if (! initDropdown) {
					initDropdown = true;
					this.setItems();
				}
			})
			// Execute command when an item from the dropdown is selected.
			this.dropdownView.on('execute', (evt) => {
				if (evt.source.isLoading) {
					this.dropdownView.isOpen = true;
					return;
				}
				let replaceAll = !!(this.listConfig.replaceAll || evt.source.replaceAll);
				this.setEditorContent(evt.source.descr, replaceAll);
				editor.editing.view.focus();
			});

            return this.dropdownView;
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
    	this.addListToDropdown( this.dropdownView, items );
		// Add the option to the collection.
    }
    addListItem(data) {
    	const item = new Collection();
    	this.clearListLoading();
    	item.add(this.listItem(data));
    	this.addListToDropdown(this.dropdownView, item);
    }
    listItem(item) {
    	return {
			type: 'button',
			model: new Model( {
				label: item.title,
				descr: item.descr,
				replaceAll: item.replaceAll || false,
				class: item.class ? item.class : '',
				isLoading: false,
				withText: true,
				template_id: item.template_id
			})
		}
    }
    setLoading() {
        const items = new Collection();
        const loading = {
			type: 'button',
			model: new Model( {
				label: 'loading ... ',
				isLoading: true,
				class: 'disabled',
				isOn: false,
				withText: true
			})
		};
		items.add( loading );
		this.addListToDropdown( this.dropdownView, items );
    }

    setEditorContent(content, replaceAll) {
    	const viewFragment = this.editor.data.processor.toView(content);
	    const modelFragment = this.editor.data.toModel( viewFragment );
	    if (replaceAll) {
	    	this.editor.execute('selectAll');
	    }
	    this.editor.model.insertContent(modelFragment);
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
			this.dropdownView.panelView.children.clear();
    		this.listLoading = false;
    	}
    }
    addListToDropdown( dropdownView, items ) {
		const locale = dropdownView.locale;
		const listView = dropdownView.listView = new ListView( locale );

		listView.items.bindTo( items ).using( ( { model } ) => {
			const listItemView = new ListItemView( locale );
			const buttonView = this.createButton();

			// Bind all model properties to the button view.
			buttonView.bind( ...Object.keys( model ) ).to( model );
			buttonView.delegate( 'execute' ).to( listItemView );
			buttonView.set({class:'w-75'});
			listItemView.children.add( buttonView );
			if (this.listConfig.deleteUrl && model.template_id) {
				const deleteButton = this.createButton('', false, 'წაშლა', deleteIcon, 'w-25');
				listItemView.children.add( deleteButton );
				deleteButton.on('execute', ()=>{
					this.deleteTemplate(model.template_id, listItemView);
				})
			}
			
			return listItemView;
		});

		dropdownView.panelView.children.add( listView );

		listView.items.delegate( 'execute' ).to( dropdownView );
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
		this.templateCount += cnt;
		this.dropdownView.buttonView.set({
			label: 'შაბლონები(' + this.templateCount + ')'
		})
	}
    static get pluginName() {
		return 'Template';
	}
}

export default Template;