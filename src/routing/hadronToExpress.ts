import * as express from "express";
import container from "../containers/container";
import { getArgs } from "../helpers/functionHelper";
import { IRoute, IRoutesConfig } from "../types/routing";
import { validateMethods } from "../validators/routing";
import listenersWrapper from '../../app/listeners';



const convertToExpress = (app: Express.Application, routes: IRoutesConfig) =>
    Object.values(routes).map((route: IRoute) => {
        validateMethods(route.methods);
        // tslint:disable-next-line:ban-types
        const middlewares: Function[] = generateMiddlewares(route) || [];
        createRoutes(app, route, middlewares);
    });

const generateMiddlewares = (route: IRoute) =>
    // tslint:disable-next-line:ban-types
    route.middleware && route.middleware.map((middleware: Function) => {
        return (req: express.Request, res: express.Response, next: express.NextFunction) => {
            Promise.resolve()
                .then(() => middleware(req, res, next))
                .catch((error) => res.send(500));
        };
    });

// tslint:disable-next-line:ban-types
const mapRouteArgs = (req: any, res: any, routeCallback: Function) => {
    return getArgs(routeCallback)
        .map((name: string) => {
            if (name === "body") {
                return req.body;
            }
            if (name === "req") {
                return req.files || req.file;
            }
            return req.params[name]
                || req.query[name]
                || res.locals[name]
                || container.take(name);
        });
};

// tslint:disable-next-line:ban-types
const createRoutes = (app: any, route: IRoute, middleware: Function[]) =>
    route.methods.map((method: string) => {
        app[method.toLowerCase()](route.path, ...middleware, (req: any, res: express.Response) => {
            Promise.resolve()
            .then(() => {
                    const args = mapRouteArgs(req, res, route.callback);
                    const eventName = 'someEvent';
                    const event = {
                        callback: route.callback,
                    }
                    const emitter = container.take('emitter');

                    const listeners = Object.values(listenersWrapper);
                    listeners.forEach(listener => {
                        if(listener.event === eventName){
                            emitter.on(eventName, listener.handler(req.params));
                        }
                    })
                    emitter.emit(eventName, event);
                    return route.callback(...args);
                })
                .then((result) => res.json(result))
                .catch((error) => res.send(500));
        });
    });

export default convertToExpress;
