classdef ReduceMeanLayer1008 < nnet.layer.Layer & nnet.layer.Formattable
    % A custom layer auto-generated while importing an ONNX network.
    %#codegen

    %#ok<*PROPLC>
    %#ok<*NBRAK>
    %#ok<*INUSL>
    %#ok<*VARARG>
    properties (Learnable)
    end

    properties (State)
    end

    properties
        Vars
        NumDims
    end

    methods(Static, Hidden)
        % Specify the properties of the class that will not be modified
        % after the first assignment.
        function p = matlabCodegenNontunableProperties(~)
            p = {
                % Constants, i.e., Vars, NumDims and all learnables and states
                'Vars'
                'NumDims'
                };
        end
    end


    methods(Static, Hidden)
        % Instantiate a codegenable layer instance from a MATLAB layer instance
        function this_cg = matlabCodegenToRedirected(mlInstance)
            this_cg = severity_net_epoch_11.coder.ReduceMeanLayer1008(mlInstance);
        end
        function this_ml = matlabCodegenFromRedirected(cgInstance)
            this_ml = severity_net_epoch_11.ReduceMeanLayer1008(cgInstance.Name);
            if isstruct(cgInstance.Vars)
                names = fieldnames(cgInstance.Vars);
                for i=1:numel(names)
                    fieldname = names{i};
                    this_ml.Vars.(fieldname) = dlarray(cgInstance.Vars.(fieldname));
                end
            else
                this_ml.Vars = [];
            end
            this_ml.NumDims = cgInstance.NumDims;
        end
    end

    methods
        function this = ReduceMeanLayer1008(mlInstance)
            this.Name = mlInstance.Name;
            this.OutputNames = {'x_blocks_blocks_3__8'};
            if isstruct(mlInstance.Vars)
                names = fieldnames(mlInstance.Vars);
                for i=1:numel(names)
                    fieldname = names{i};
                    this.Vars.(fieldname) = severity_net_epoch_11.coder.ops.extractIfDlarray(mlInstance.Vars.(fieldname));
                end
            else
                this.Vars = [];
            end

            this.NumDims = mlInstance.NumDims;
        end

        function [x_blocks_blocks_3__8] = predict(this, x_blocks_blocks_3__2__)
            if isdlarray(x_blocks_blocks_3__2__)
                x_blocks_blocks_3__2_ = stripdims(x_blocks_blocks_3__2__);
            else
                x_blocks_blocks_3__2_ = x_blocks_blocks_3__2__;
            end
            x_blocks_blocks_3__2NumDims = 4;
            x_blocks_blocks_3__2 = severity_net_epoch_11.coder.ops.permuteInputVar(x_blocks_blocks_3__2_, [4 3 1 2], 4);

            [x_blocks_blocks_3__8__, x_blocks_blocks_3__8NumDims__] = ReduceMeanGraph1024(this, x_blocks_blocks_3__2, x_blocks_blocks_3__2NumDims, false);
            x_blocks_blocks_3__8_ = severity_net_epoch_11.coder.ops.permuteOutputVar(x_blocks_blocks_3__8__, [3 4 2 1], 4);

            x_blocks_blocks_3__8 = dlarray(single(x_blocks_blocks_3__8_), 'SSCB');
        end

        function [x_blocks_blocks_3__8, x_blocks_blocks_3__8NumDims1026] = ReduceMeanGraph1024(this, x_blocks_blocks_3__2, x_blocks_blocks_3__2NumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims1016 = severity_net_epoch_11.coder.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1025, coder.const(x_blocks_blocks_3__2NumDims));
            xReduced1017 = mean(x_blocks_blocks_3__2, dims1016);
            x_blocks_blocks_3__8 = xReduced1017;
            x_blocks_blocks_3__8NumDims = coder.const(x_blocks_blocks_3__2NumDims);

            % Set graph output arguments
            x_blocks_blocks_3__8NumDims1026 = coder.const(x_blocks_blocks_3__8NumDims);

        end

    end

end