import { Application } from "@hotwired/stimulus"
import ModalController from "./modal_controller"

const application = Application.start()
application.register("modal", ModalController)
